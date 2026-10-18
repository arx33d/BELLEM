import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchStatus,
  fetchModels,
  fetchChats,
  fetchChat,
  saveChat as apiSaveChat,
  deleteChat as apiDeleteChat,
  clearAllChats as apiClearAllChats,
  updateChatTitle as apiUpdateChatTitle,
  toggleChatPin as apiToggleChatPin,
  generateChatTitle,
  fetchSettings,
  saveSettings as apiSaveSettings,
  streamChatCompletion
} from '../utils/api';

export function useChat() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentChat, setCurrentChat] = useState({
    id: `chat_${Date.now()}`,
    title: 'New conversation',
    model: '',
    messages: []
  });

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [providerStatus, setProviderStatus] = useState(null);
  const [settings, setSettings] = useState(null);

  const [isStreaming, setIsStreaming] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelManagerOpen, setIsModelManagerOpen] = useState(false);
  const [isWebActive, setIsWebActive] = useState(true);

  const abortControllerRef = useRef(null);

  // Initial load
  useEffect(() => {
    async function init() {
      // Load settings
      const loadedSettings = await fetchSettings();
      if (loadedSettings) {
        setSettings(loadedSettings);
      }

      // Check status
      const status = await fetchStatus();
      setProviderStatus(status);

      // Load models
      const modelsData = await fetchModels();
      const loadedModels = modelsData.models || [];
      setModels(loadedModels);

      let initialModel = '';
      if (loadedSettings?.defaultModel && loadedModels.some(m => m.name === loadedSettings.defaultModel)) {
        initialModel = loadedSettings.defaultModel;
      } else if (loadedModels.length > 0) {
        initialModel = loadedModels[0].name;
      }
      setSelectedModel(initialModel);

      // Load chats
      const savedChats = await fetchChats();
      setChats(savedChats);

      if (savedChats.length > 0) {
        // Load the most recent chat
        const recentId = savedChats[0].id;
        const fullChat = await fetchChat(recentId);
        if (fullChat) {
          setCurrentChat(fullChat);
          setCurrentChatId(fullChat.id);
          if (fullChat.model && loadedModels.some(m => m.name === fullChat.model)) {
            setSelectedModel(fullChat.model);
          }
        }
      } else {
        // Create initial empty chat
        const newId = `chat_${Date.now()}`;
        const newChatObj = {
          id: newId,
          title: 'New conversation',
          model: initialModel,
          messages: [],
          createdAt: new Date().toISOString()
        };
        setCurrentChat(newChatObj);
        setCurrentChatId(newId);
      }
    }

    init();
  }, []);

  // Refresh models
  const refreshModels = useCallback(async () => {
    setIsRefreshingModels(true);
    try {
      const modelsData = await fetchModels();
      const loaded = modelsData.models || [];
      setModels(loaded);
      if (!selectedModel && loaded.length > 0) {
        setSelectedModel(loaded[0].name);
      }
      const status = await fetchStatus();
      setProviderStatus(status);
    } finally {
      setIsRefreshingModels(false);
    }
  }, [selectedModel]);

  // Create new chat
  const createNewChat = useCallback(() => {
    if (isStreaming) {
      stopGeneration();
    }
    const newId = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newChatObj = {
      id: newId,
      title: 'New conversation',
      model: selectedModel,
      messages: [],
      createdAt: new Date().toISOString()
    };
    setCurrentChat(newChatObj);
    setCurrentChatId(newId);
  }, [isStreaming, selectedModel]);

  // Select an existing chat
  const selectChat = useCallback(async (id) => {
    if (id === currentChatId) return;
    if (isStreaming) {
      stopGeneration();
    }
    const fullChat = await fetchChat(id);
    if (fullChat) {
      setCurrentChat(fullChat);
      setCurrentChatId(fullChat.id);
      if (fullChat.model && models.some(m => m.name === fullChat.model)) {
        setSelectedModel(fullChat.model);
      }
    }
  }, [currentChatId, isStreaming, models]);

  // Rename a chat
  const renameChat = useCallback(async (id, newTitle) => {
    await apiUpdateChatTitle(id, newTitle);
    setChats(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
    if (currentChatId === id) {
      setCurrentChat(prev => ({ ...prev, title: newTitle }));
    }
  }, [currentChatId]);

  // Pin a chat
  const togglePin = useCallback(async (id) => {
    await apiToggleChatPin(id);
    setChats(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c);
      return updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
    });
  }, []);

  // Delete chat
  const deleteChat = useCallback(async (id) => {
    await apiDeleteChat(id);
    const updatedChats = chats.filter(c => c.id !== id);
    setChats(updatedChats);

    if (currentChatId === id) {
      if (updatedChats.length > 0) {
        selectChat(updatedChats[0].id);
      } else {
        createNewChat();
      }
    }
  }, [chats, currentChatId, selectChat, createNewChat]);

  // Clear all chats
  const clearAllChats = useCallback(async () => {
    await apiClearAllChats();
    setChats([]);
    createNewChat();
  }, [createNewChat]);

  // Import chats
  const importChats = useCallback((imported) => {
    for (const chat of imported) {
      apiSaveChat(chat);
    }
    fetchChats().then(setChats);
  }, []);

  // Stop Generation
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Send Message
  const sendMessage = useCallback(async (promptText, attachments = []) => {
    if ((!promptText && attachments.length === 0) || isStreaming) return;

    const activeModel = selectedModel || (models[0] ? models[0].name : '');
    if (!activeModel) {
      alert('Please select or download a local model first.');
      return;
    }

    const userMessageId = `msg_${Date.now()}`;
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: promptText,
      createdAt: new Date().toISOString(),
      attachments: attachments || []
    };

    const assistantMessageId = `msg_${Date.now() + 1}`;
    const assistantMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      model: activeModel,
      createdAt: new Date().toISOString(),
      stats: null
    };

    const updatedMessages = [...currentChat.messages, userMessage, assistantMessage];
    const isFirstExchange = currentChat.messages.length === 0;

    // Update state immediately with user message and placeholder assistant message
    const updatedChat = {
      ...currentChat,
      model: activeModel,
      messages: updatedMessages
    };

    setCurrentChat(updatedChat);
    setIsStreaming(true);

    // Abort controller for cancellation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Build payload messages for API (exclude placeholder and empty messages)
    const apiMessages = updatedMessages
      .slice(0, -1)
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.content && m.content.trim().length > 0))
      .map(m => {
        const item = {
          role: m.role,
          content: m.content
        };

      // Add image base64 if present
      if (m.attachments && m.attachments.length > 0) {
        const imageAttachments = m.attachments.filter(a => a.type === 'image' && a.base64);
        if (imageAttachments.length > 0) {
          item.images = imageAttachments.map(a => a.base64);
        }

        // Prepend text attachments to prompt content
        const textAttachments = m.attachments.filter(a => a.type === 'text' && a.content);
        if (textAttachments.length > 0) {
          const docsText = textAttachments.map(a => `--- File: ${a.name} ---\n${a.content}\n--- End File ---`).join('\n\n');
          item.content = `${docsText}\n\n${item.content}`;
        }
      }

      return item;
    });

    let accumulatedContent = '';
    let currentSources = null;
    let currentWebAnalysis = null;
    let currentSiteMap = null;
    let currentSiteCommands = null;
    let currentFSafe = null;

    const onWebAnalysis = (webAnalysis) => {
      currentWebAnalysis = webAnalysis;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            webAnalysis
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onSiteMap = (siteMap) => {
      currentSiteMap = siteMap;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            siteMap
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onSiteCommands = (siteCommands) => {
      currentSiteCommands = siteCommands;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            siteCommands
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onFSafe = (fsafe) => {
      currentFSafe = fsafe;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            fsafe
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onSources = (sources) => {
      currentSources = sources;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            sources
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onChunk = (chunk) => {
      accumulatedContent += chunk;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            content: accumulatedContent
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onStats = (stats) => {
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            stats
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    const onDone = async (finalData) => {
      setIsStreaming(false);
      abortControllerRef.current = null;

      // Final chat state to save
      const finalChat = {
        ...updatedChat,
        messages: updatedMessages.map((m, idx) => {
          if (idx === updatedMessages.length - 1) {
            return {
              ...m,
              content: accumulatedContent,
              stats: finalData.stats || m.stats,
              sources: currentSources || m.sources || null,
              webAnalysis: currentWebAnalysis || m.webAnalysis || null,
              siteMap: currentSiteMap || m.siteMap || null,
              siteCommands: currentSiteCommands || m.siteCommands || null,
              fsafe: currentFSafe || m.fsafe || null
            };
          }
          return m;
        })
      };

      // Auto-generate title if this was the first exchange
      if (isFirstExchange && (!finalChat.title || finalChat.title === 'New conversation')) {
        const generatedTitle = await generateChatTitle(activeModel, promptText);
        finalChat.title = generatedTitle;
      }

      // Persist to backend
      const saved = await apiSaveChat(finalChat);
      setCurrentChat(saved);

      // Refresh sidebar list
      const allChats = await fetchChats();
      setChats(allChats);
    };

    const onError = (err) => {
      console.error('Streaming error:', err);
      setIsStreaming(false);
      abortControllerRef.current = null;
      accumulatedContent += `\n\n*[Error generating response: ${err.message}]*`;
      setCurrentChat(prev => {
        const msgs = [...prev.messages];
        const lastIdx = msgs.length - 1;
        if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
          msgs[lastIdx] = {
            ...msgs[lastIdx],
            content: accumulatedContent
          };
        }
        return { ...prev, messages: msgs };
      });
    };

    // Trigger stream
    await streamChatCompletion({
      model: activeModel,
      messages: apiMessages,
      temperature: settings?.temperature,
      topP: settings?.topP,
      topK: settings?.topK,
      contextLength: settings?.contextLength,
      systemPrompt: settings?.systemPrompt,
      safeguardLevel: settings?.safeguardLevel || 'default safeguard',
      resourceFolders: settings?.resourceFolders || [],
      webSearchEnabled: isWebActive,
      webAnalyzeEnabled: true,
      signal: controller.signal,
      onSources,
      onWebAnalysis,
      onSiteMap,
      onSiteCommands,
      onFSafe,
      onChunk,
      onStats,
      onError,
      onDone
    });
  }, [currentChat, isStreaming, selectedModel, models, settings]);

  // Regenerate last assistant response
  const regenerateResponse = useCallback(() => {
    if (isStreaming || currentChat.messages.length === 0) return;

    const messages = [...currentChat.messages];
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === 'assistant') {
      messages.pop(); // remove assistant message
    }

    if (messages.length === 0) return;

    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg.role === 'user') {
      // Re-run with user prompt
      const previousMessages = messages.slice(0, -1);
      setCurrentChat(prev => ({
        ...prev,
        messages: previousMessages
      }));
      sendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [isStreaming, currentChat, sendMessage]);

  // Edit user message and re-run
  const editMessage = useCallback((messageId, newContent) => {
    if (isStreaming) return;

    const index = currentChat.messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

    const targetMsg = currentChat.messages[index];
    const truncated = currentChat.messages.slice(0, index);

    setCurrentChat(prev => ({
      ...prev,
      messages: truncated
    }));

    sendMessage(newContent, targetMsg.attachments || []);
  }, [isStreaming, currentChat, sendMessage]);

  // Save Settings
  const saveSettings = useCallback(async (newSettings) => {
    const saved = await apiSaveSettings(newSettings);
    setSettings(saved);
    if (saved.defaultModel && models.some(m => m.name === saved.defaultModel)) {
      setSelectedModel(saved.defaultModel);
    }
  }, [models]);

  return {
    chats,
    currentChatId,
    currentChat,
    models,
    selectedModel,
    providerStatus,
    settings,
    isStreaming,
    isRefreshingModels,
    isSidebarOpen,
    isSettingsOpen,
    isModelManagerOpen,
    setIsSidebarOpen,
    setIsSettingsOpen,
    setIsModelManagerOpen,
    setSelectedModel,
    createNewChat,
    selectChat,
    renameChat,
    togglePin,
    deleteChat,
    clearAllChats,
    importChats,
    sendMessage,
    stopGeneration,
    regenerateResponse,
    editMessage,
    refreshModels,
    saveSettings,
    isWebActive,
    setIsWebActive
  };
}
