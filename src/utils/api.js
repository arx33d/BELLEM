// Client API utility for Gemini Local

const API_BASE = '/api';

export async function fetchStatus() {
  try {
    const res = await fetch(`${API_BASE}/status`);
    return await res.json();
  } catch (err) {
    return {
      ollama: { connected: false, url: '' },
      lmStudio: { connected: false, url: '' },
      error: err.message
    };
  }
}

export async function fetchModels() {
  try {
    const res = await fetch(`${API_BASE}/models`);
    return await res.json();
  } catch (err) {
    return { models: [], providers: {} };
  }
}

export async function pullModel(modelName, onProgress) {
  const res = await fetch(`${API_BASE}/models/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelName })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Failed to pull model');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));
          if (onProgress) onProgress(data);
        } catch (e) {}
      }
    }
  }
}

export async function deleteModel(modelName) {
  const res = await fetch(`${API_BASE}/models/${encodeURIComponent(modelName)}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function fetchChats() {
  try {
    const res = await fetch(`${API_BASE}/chats`);
    return await res.json();
  } catch (err) {
    return [];
  }
}

export async function fetchChat(id) {
  try {
    const res = await fetch(`${API_BASE}/chats/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function saveChat(chat) {
  try {
    const res = await fetch(`${API_BASE}/chats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chat)
    });
    return await res.json();
  } catch (err) {
    console.error('Error saving chat:', err);
    return chat;
  }
}

export async function updateChatTitle(id, title) {
  const res = await fetch(`${API_BASE}/chats/${id}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
  return await res.json();
}

export async function toggleChatPin(id) {
  const res = await fetch(`${API_BASE}/chats/${id}/pin`, {
    method: 'PATCH'
  });
  return await res.json();
}

export async function deleteChat(id) {
  const res = await fetch(`${API_BASE}/chats/${id}`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function clearAllChats() {
  const res = await fetch(`${API_BASE}/chats`, {
    method: 'DELETE'
  });
  return await res.json();
}

export async function generateChatTitle(model, prompt) {
  try {
    const res = await fetch(`${API_BASE}/chat/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt })
    });
    const data = await res.json();
    return data.title || 'Conversation';
  } catch (err) {
    return 'Conversation';
  }
}

export async function uploadFiles(files) {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  });
  return await res.json();
}

export async function fetchSettings() {
  try {
    const res = await fetch(`${API_BASE}/settings`);
    return await res.json();
  } catch (err) {
    return null;
  }
}

export async function saveSettings(settings) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return await res.json();
}

export async function fetchResourceFolders() {
  try {
    const res = await fetch(`${API_BASE}/resources/folders`);
    return await res.json();
  } catch (err) {
    return { folders: [] };
  }
}

export async function addResourceFolder(folderPath) {
  const res = await fetch(`${API_BASE}/resources/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add folder');
  }
  return await res.json();
}

export async function removeResourceFolder(folderPath) {
  const res = await fetch(`${API_BASE}/resources/folders`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath })
  });
  return await res.json();
}

export async function analyzeWebsite(targetUrl) {
  const res = await fetch(`${API_BASE}/web/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to inspect website');
  }
  return await res.json();
}

export async function searchWeb(query, maxResults = 5) {
  const res = await fetch(`${API_BASE}/web/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to search web');
  }
  return await res.json();
}

export async function crawlWebsite(targetUrl, options = {}) {
  const res = await fetch(`${API_BASE}/web/crawl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, ...options })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to crawl website');
  }
  return await res.json();
}

export async function runSiteCommand(targetUrl, command, args = {}) {
  const res = await fetch(`${API_BASE}/web/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, command, args })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `Failed to run site command "${command}"`);
  }
  return await res.json();
}

export async function runFullSiteAudit(targetUrl, options = {}) {
  const res = await fetch(`${API_BASE}/web/audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl, ...options })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to audit website');
  }
  return await res.json();
}

export async function runFSafeScan(targetUrl) {
  const res = await fetch(`${API_BASE}/web/fsafe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: targetUrl })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to run FSafe security scan');
  }
  return await res.json();
}

export async function streamChatCompletion({
  model,
  messages,
  provider = 'ollama',
  temperature,
  topP,
  topK,
  contextLength,
  systemPrompt,
  safeguardLevel,
  resourceFolders,
  webSearchEnabled = true,
  webAnalyzeEnabled = true,
  signal,
  onChunk,
  onStats,
  onSources,
  onWebAnalysis,
  onSiteMap,
  onSiteCommands,
  onFSafe,
  onError,
  onDone
}) {
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        provider,
        temperature,
        topP,
        topK,
        contextLength,
        systemPrompt,
        safeguardLevel,
        resourceFolders,
        webSearchEnabled,
        webAnalyzeEnabled
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Failed to start chat stream');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.error) {
              if (onError) onError(new Error(data.error));
              return;
            }
            if (data.webAnalysis && onWebAnalysis) {
              onWebAnalysis(data.webAnalysis);
            }
            if (data.siteMap && onSiteMap) {
              onSiteMap(data.siteMap);
            }
            if (data.siteCommands && onSiteCommands) {
              onSiteCommands(data.siteCommands);
            }
            if (data.fsafe && onFSafe) {
              onFSafe(data.fsafe);
            }
            if (data.sources && onSources) {
              onSources(data.sources);
            }
            if (data.content && onChunk) {
              onChunk(data.content);
            }
            if (data.stats && onStats) {
              onStats(data.stats);
            }
            if (data.done) {
              if (onDone) onDone(data);
            }
          } catch (e) {
            // ignore partial json
          }
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      if (onDone) onDone({ aborted: true });
      return;
    }
    if (onError) onError(err);
  }
}
