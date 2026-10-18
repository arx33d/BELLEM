import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Search,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
  Settings,
  DownloadCloud,
  ChevronLeft
} from 'lucide-react';

// Time group helpers
function groupChatsByDate(chats, searchQuery) {
  const filtered = chats.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pinned = [];
  const today = [];
  const yesterday = [];
  const prev7Days = [];
  const older = [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOf7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

  for (const chat of filtered) {
    if (chat.pinned) {
      pinned.push(chat);
      continue;
    }

    const chatTime = new Date(chat.updatedAt || chat.createdAt).getTime();
    if (chatTime >= startOfToday) {
      today.push(chat);
    } else if (chatTime >= startOfYesterday) {
      yesterday.push(chat);
    } else if (chatTime >= startOf7Days) {
      prev7Days.push(chat);
    } else {
      older.push(chat);
    }
  }

  return { pinned, today, yesterday, prev7Days, older };
}

export default function Sidebar({
  chats = [],
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onTogglePin,
  onOpenSettings,
  onOpenModelManager,
  isOpen,
  onToggleOpen
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  const groups = groupChatsByDate(chats, search);

  const startRename = (chat, e) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditTitle(chat.title);
  };

  const saveRename = (chatId, e) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      onRenameChat(chatId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const renderChatGroup = (title, chatList) => {
    if (chatList.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-3 py-1 text-[11px] font-semibold text-gemini-textDim uppercase tracking-wider">
          {title}
        </div>
        <div className="space-y-0.5 mt-1">
          {chatList.map((chat) => {
            const isActive = chat.id === currentChatId;
            const isEditing = chat.id === editingId;

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                  isActive
                    ? 'bg-gemini-surface-variant text-white font-medium border border-gemini-borderLight'
                    : 'text-gemini-text hover:bg-gemini-hover/70 hover:text-white'
                }`}
              >
                {/* Chat title or edit field */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gemini-textDim'}`} />
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(chat.id, e);
                          if (e.key === 'Escape') cancelRename(e);
                        }}
                        autoFocus
                        className="w-full bg-[#131314] px-1.5 py-0.5 rounded border border-gemini-blue text-xs text-white focus:outline-none"
                      />
                      <button onClick={(e) => saveRename(chat.id, e)} className="p-0.5 text-green-400 hover:text-green-300">
                        <Check className="w-3 h-3" />
                      </button>
                      <button onClick={cancelRename} className="p-0.5 text-red-400 hover:text-red-300">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="truncate flex-1">{chat.title}</span>
                  )}
                </div>

                {/* Hover action icons */}
                {!isEditing && (
                  <div className={`flex items-center gap-1 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(chat.id);
                      }}
                      className={`p-1 rounded hover:bg-gemini-surface ${chat.pinned ? 'text-white' : 'text-gemini-textDim hover:text-white'}`}
                      title={chat.pinned ? 'Unpin chat' : 'Pin chat'}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => startRename(chat, e)}
                      className="p-1 rounded hover:bg-gemini-surface text-gemini-textDim hover:text-white"
                      title="Rename chat"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="p-1 rounded hover:bg-gemini-surface text-gemini-textDim hover:text-red-400"
                      title="Delete chat"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col bg-gemini-sidebar border-r border-gemini-border transition-all duration-300 select-none ${
        isOpen ? 'w-64 md:w-72 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-r-0 md:overflow-hidden'
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gemini-border/40">
        <span className="text-sm font-bold tracking-wider text-white font-mono">
          BELLEM
        </span>
        <button
          onClick={onToggleOpen}
          className="md:hidden p-1.5 rounded-lg hover:bg-gemini-hover text-gemini-textMuted"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-gemini-surface hover:bg-gemini-surface-variant border border-gemini-border hover:border-gemini-borderLight text-xs font-semibold text-white shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 text-gemini-textMuted" />
          <span>New chat</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gemini-textDim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gemini-surface border border-gemini-border/60 text-xs text-gemini-text placeholder:text-gemini-textDim focus:outline-none focus:border-gemini-borderLight"
          />
        </div>
      </div>

      {/* Conversation List Scroll Area */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {chats.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-gemini-textDim">
            No conversations yet
          </div>
        ) : (
          <>
            {renderChatGroup('Pinned', groups.pinned)}
            {renderChatGroup('Today', groups.today)}
            {renderChatGroup('Yesterday', groups.yesterday)}
            {renderChatGroup('Previous 7 Days', groups.prev7Days)}
            {renderChatGroup('Older', groups.older)}
          </>
        )}
      </div>

      {/* Bottom Footer Section */}
      <div className="p-3 border-t border-gemini-border/60 bg-gemini-surface/30 space-y-1 text-xs">
        {/* Model Manager button */}
        <button
          onClick={onOpenModelManager}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gemini-text hover:text-white hover:bg-gemini-hover transition-colors font-medium"
        >
          <DownloadCloud className="w-4 h-4 text-gemini-textMuted" />
          <span>Model</span>
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gemini-text hover:text-white hover:bg-gemini-hover transition-colors font-medium"
        >
          <Settings className="w-4 h-4 text-gemini-textMuted" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
