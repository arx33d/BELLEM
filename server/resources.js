import fs from 'fs';
import path from 'path';

let pdfParse = null;
try {
  const mod = await import('pdf-parse');
  pdfParse = mod.default || mod;
} catch (e) {
  // pdf-parse optional fallback
}

const SUPPORTED_TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.json', '.csv', '.tsv',
  '.xml', '.yaml', '.yml', '.html', '.htm', '.log',
  '.py', '.js', '.ts', '.jsx', '.tsx', '.sql', '.sh',
  '.bat', '.ps1', '.c', '.cpp', '.h', '.cs', '.java', '.go', '.rs'
]);

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.svn', '.hg', 'dist', 'build',
  'coverage', '.next', '.vscode', '.idea', '__pycache__'
]);

// Recursively find all supported files in a folder
export function scanFolderFiles(dirPath, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return [];
  
  let results = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanFolderFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_TEXT_EXTENSIONS.has(ext) || ext === '.pdf') {
          results.push({
            name: entry.name,
            path: fullPath,
            size: fs.statSync(fullPath).size,
            ext
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning folder ${dirPath}:`, err.message);
  }
  return results;
}

// Extract text content from a file
export async function readFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  try {
    if (ext === '.pdf') {
      if (pdfParse) {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text || '';
      }
      return '';
    }

    if (SUPPORTED_TEXT_EXTENSIONS.has(ext)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return '';
}

// Split text into semantic chunks
export function chunkText(text, filename, maxChunkSize = 900, overlap = 150) {
  if (!text || !text.trim()) return [];

  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const cleaned = para.trim();
    if (!cleaned) continue;

    if (currentChunk.length + cleaned.length > maxChunkSize) {
      if (currentChunk.trim()) {
        chunks.push({
          filename,
          text: currentChunk.trim()
        });
      }
      // Preserve overlap
      currentChunk = currentChunk.slice(-overlap) + '\n' + cleaned;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + cleaned;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      filename,
      text: currentChunk.trim()
    });
  }

  return chunks;
}

// Tokenize and clean text into search keywords
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// Search and rank chunks using keyword BM25/TF-IDF heuristic
export async function retrieveRelevantContext(query, folderPaths, maxResults = 5) {
  if (!folderPaths || folderPaths.length === 0 || !query || !query.trim()) {
    return { chunks: [], sources: [] };
  }

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return { chunks: [], sources: [] };

  const allChunks = [];
  const scannedFiles = [];

  for (const folder of folderPaths) {
    if (!fs.existsSync(folder)) continue;
    const files = scanFolderFiles(folder);
    for (const file of files) {
      scannedFiles.push(file);
      // Skip very large files (> 15MB) to maintain fast responses
      if (file.size > 15 * 1024 * 1024) continue;

      const content = await readFileContent(file.path);
      if (content) {
        const fileChunks = chunkText(content, file.name);
        allChunks.push(...fileChunks);
      }
    }
  }

  if (allChunks.length === 0) {
    return { chunks: [], sources: [] };
  }

  // Score each chunk
  const scored = allChunks.map(chunk => {
    const chunkTokens = tokenize(chunk.text);
    const chunkTokenSet = new Set(chunkTokens);
    
    let score = 0;
    // Exact phrase match bonus
    if (chunk.text.toLowerCase().includes(query.toLowerCase().trim())) {
      score += 8;
    }

    // Token frequency & overlap scoring
    for (const q of queryTokens) {
      if (chunkTokenSet.has(q)) {
        score += 2;
        // Count occurrences
        const occurrences = chunkTokens.filter(t => t === q).length;
        score += Math.min(occurrences, 4) * 0.5;
      }
      // Match in filename bonus
      if (chunk.filename.toLowerCase().includes(q)) {
        score += 3;
      }
    }

    return { ...chunk, score };
  });

  // Filter chunks with positive relevance and sort highest first
  const relevant = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const sources = [...new Set(relevant.map(c => c.filename))];

  return {
    chunks: relevant,
    sources
  };
}
