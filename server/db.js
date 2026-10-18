import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default settings
const DEFAULT_SETTINGS = {
  ollamaUrl: 'http://localhost:11434',
  lmStudioUrl: 'http://localhost:1234/v1',
  activeProvider: 'ollama', // 'ollama' | 'lmstudio' | 'custom'
  defaultModel: '',
  systemPrompt: 'You are a helpful, precise, and thoughtful assistant.',
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  contextLength: 4096,
  theme: 'dark',
  autoTitle: true,
  stream: true,
  safeguardLevel: 'default safeguard', // 'uncensored' | 'light safeguard' | 'default safeguard' | 'high safeguard' | 'max safeguard'
  resourceFolders: [],
  webSearchEnabled: true,
  webAnalyzeEnabled: true,
};

function safeReadJSON(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return fallback;
  }
}

function safeWriteJSON(filePath, data) {
  try {
    const tempFile = `${filePath}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, filePath);
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

// Conversation functions
export function getAllChats() {
  const chats = safeReadJSON(CHATS_FILE, []);
  // Return metadata for sidebar list (omit message content to keep it light)
  return chats.map(c => ({
    id: c.id,
    title: c.title,
    model: c.model,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    pinned: !!c.pinned,
    messageCount: c.messages ? c.messages.length : 0,
    lastMessage: c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1].content.slice(0, 80) : ''
  })).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function getChatById(id) {
  const chats = safeReadJSON(CHATS_FILE, []);
  return chats.find(c => c.id === id) || null;
}

export function saveChat(chat) {
  const chats = safeReadJSON(CHATS_FILE, []);
  const index = chats.findIndex(c => c.id === chat.id);
  
  const now = new Date().toISOString();
  if (index >= 0) {
    chats[index] = {
      ...chats[index],
      ...chat,
      updatedAt: now
    };
  } else {
    chats.unshift({
      id: chat.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: chat.title || 'New conversation',
      model: chat.model || '',
      createdAt: chat.createdAt || now,
      updatedAt: now,
      pinned: !!chat.pinned,
      messages: chat.messages || []
    });
  }
  
  safeWriteJSON(CHATS_FILE, chats);
  return chats.find(c => c.id === (chat.id || chats[0].id));
}

export function deleteChat(id) {
  let chats = safeReadJSON(CHATS_FILE, []);
  chats = chats.filter(c => c.id !== id);
  safeWriteJSON(CHATS_FILE, chats);
  return true;
}

export function clearAllChats() {
  safeWriteJSON(CHATS_FILE, []);
  return true;
}

export function getSettings() {
  const saved = safeReadJSON(SETTINGS_FILE, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

export function updateSettings(newSettings) {
  const current = getSettings();
  const updated = { ...current, ...newSettings };
  safeWriteJSON(SETTINGS_FILE, updated);
  return updated;
}
