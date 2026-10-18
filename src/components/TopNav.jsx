import React from 'react';
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  Plus
} from 'lucide-react';
import ModelSelector from './ModelSelector';

export default function TopNav({
  isSidebarOpen,
  onToggleSidebar,
  models,
  selectedModel,
  onSelectModel,
  onRefreshModels,
  onOpenModelManager,
  onNewChat,
  isRefreshing
}) {
  return (
    <header className="h-14 border-b border-gemini-border/60 bg-gemini-bg/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left section: Sidebar toggle & model selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-gemini-textMuted hover:text-white hover:bg-gemini-hover transition-colors"
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-5 h-5 hidden md:block" />
          ) : (
            <PanelLeft className="w-5 h-5 hidden md:block" />
          )}
          <Menu className="w-5 h-5 md:hidden" />
        </button>

        {/* Model Selector Dropdown */}
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          onRefresh={onRefreshModels}
          onOpenModelManager={onOpenModelManager}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Right section: New chat button */}
      <div className="flex items-center gap-2">
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-xs text-gemini-text hover:text-white transition-all font-medium"
          title="Start new conversation"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New chat</span>
        </button>
      </div>
    </header>
  );
}
