import React from 'react';
import { useChat } from './hooks/useChat';
import { useSpeech } from './hooks/useSpeech';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import ChatArea from './components/ChatArea';
import InputBar from './components/InputBar';
import SettingsModal from './components/SettingsModal';
import ModelManagerModal from './components/ModelManagerModal';

export default function App() {
  const {
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
  } = useChat();

  const {
    isSupported: isSpeechSupported,
    speakingId,
    speak,
    stopSpeaking
  } = useSpeech();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gemini-bg text-gemini-text font-sans">
      {/* Left Sidebar */}
      <Sidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={selectChat}
        onNewChat={createNewChat}
        onDeleteChat={deleteChat}
        onRenameChat={renameChat}
        onTogglePin={togglePin}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenModelManager={() => setIsModelManagerOpen(true)}
        providerStatus={providerStatus}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-gemini-bg relative">
        {/* Top Navigation */}
        <TopNav
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          models={models}
          selectedModel={selectedModel}
          onSelectModel={setSelectedModel}
          onRefreshModels={refreshModels}
          onOpenModelManager={() => setIsModelManagerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onNewChat={createNewChat}
          isRefreshing={isRefreshingModels}
        />

        {/* Message Feed / Welcome Screen */}
        <ChatArea
          messages={currentChat?.messages || []}
          isStreaming={isStreaming}
          selectedModel={selectedModel}
          onSendMessage={sendMessage}
          onRegenerate={regenerateResponse}
          onEditMessage={editMessage}
          speakingId={speakingId}
          onToggleSpeak={(msgId, text) => speak(msgId, text)}
        />

        {/* Floating Capsule Input */}
        <InputBar
          onSendMessage={sendMessage}
          isStreaming={isStreaming}
          onStopGeneration={stopGeneration}
          selectedModel={selectedModel}
          disabled={!selectedModel && models.length === 0}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isWebActive={isWebActive}
          onToggleWeb={() => setIsWebActive(!isWebActive)}
        />
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={saveSettings}
        onClearAllChats={clearAllChats}
        chats={chats}
        onImportChats={importChats}
      />

      {/* Model Manager / Hub Modal */}
      <ModelManagerModal
        isOpen={isModelManagerOpen}
        onClose={() => setIsModelManagerOpen(false)}
        models={models}
        onModelsChanged={refreshModels}
      />
    </div>
  );
}
