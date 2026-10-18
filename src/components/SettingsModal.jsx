import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { fetchResourceFolders, addResourceFolder, removeResourceFolder } from '../utils/api';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearAllChats,
  chats = [],
  onImportChats
}) {
  const [form, setForm] = useState(settings || {});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [folderDetails, setFolderDetails] = useState([]);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [folderError, setFolderError] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
    if (isOpen) {
      fetchResourceFolders().then(data => {
        setFolderDetails(data?.folders || []);
      });
    }
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleAddFolder = async () => {
    if (!newFolderPath.trim()) return;
    setFolderError('');
    setIsAddingFolder(true);
    try {
      const res = await addResourceFolder(newFolderPath.trim());
      if (res.resourceFolders) {
        setForm(prev => ({ ...prev, resourceFolders: res.resourceFolders }));
        const refreshed = await fetchResourceFolders();
        setFolderDetails(refreshed?.folders || []);
        setNewFolderPath('');
      }
    } catch (err) {
      setFolderError(err.message || 'Failed to add folder');
    } finally {
      setIsAddingFolder(false);
    }
  };

  const handleRemoveFolder = async (folderPath) => {
    try {
      const res = await removeResourceFolder(folderPath);
      if (res.resourceFolders) {
        setForm(prev => ({ ...prev, resourceFolders: res.resourceFolders }));
        setFolderDetails(prev => prev.filter(f => f.path !== folderPath));
      }
    } catch (err) {
      console.error('Failed to remove folder:', err);
    }
  };

  const handleSave = () => {
    onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleExportHistory = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chats, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `bellem_chats_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportHistory = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported) && onImportChats) {
          onImportChats(imported);
          alert(`Successfully imported ${imported.length} conversations.`);
        }
      } catch (err) {
        alert('Failed to parse chat JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-[#1e1f20] border border-gemini-border rounded-3xl shadow-gemini overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gemini-border">
          <h2 className="text-sm font-bold tracking-wide uppercase text-white font-mono">Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Provider Endpoints */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-3">
              Endpoints
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gemini-textMuted mb-1">
                  Ollama URL
                </label>
                <input
                  type="text"
                  value={form.ollamaUrl || ''}
                  onChange={(e) => setForm({ ...form, ollamaUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                  className="w-full px-3 py-2 rounded-xl bg-gemini-surface border border-gemini-border text-xs text-white focus:outline-none focus:border-gemini-borderLight font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gemini-textMuted mb-1">
                  LM Studio URL
                </label>
                <input
                  type="text"
                  value={form.lmStudioUrl || ''}
                  onChange={(e) => setForm({ ...form, lmStudioUrl: e.target.value })}
                  placeholder="http://localhost:1234/v1"
                  className="w-full px-3 py-2 rounded-xl bg-gemini-surface border border-gemini-border text-xs text-white focus:outline-none focus:border-gemini-borderLight font-mono"
                />
              </div>
            </div>
          </div>

          {/* Web & Online Analysis */}
          <div className="pt-2 border-t border-gemini-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-3">
              Online Search & Website Analysis
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.webSearchEnabled ?? true}
                  onChange={(e) => setForm({ ...form, webSearchEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gemini-border bg-gemini-surface accent-white cursor-pointer"
                />
                <div>
                  <div className="text-xs text-white font-medium">Enable Web Search</div>
                  <div className="text-[11px] text-gemini-textDim">Search the web for up-to-date facts and cite sources in responses</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.webAnalyzeEnabled ?? true}
                  onChange={(e) => setForm({ ...form, webAnalyzeEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gemini-border bg-gemini-surface accent-white cursor-pointer"
                />
                <div>
                  <div className="text-xs text-white font-medium">Enable Full Website Analysis</div>
                  <div className="text-[11px] text-gemini-textDim">Inspect URLs for tech stack, security headers, metadata, and behind-the-scenes breakdown</div>
                </div>
              </label>
            </div>
          </div>

          {/* Model Parameters */}
          <div className="pt-2 border-t border-gemini-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-3">
              Parameters
            </h3>

            {/* Safeguards */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gemini-textMuted mb-1">
                Safeguards
              </label>
              <select
                value={form.safeguardLevel || 'default safeguard'}
                onChange={(e) => setForm({ ...form, safeguardLevel: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-gemini-surface border border-gemini-border text-xs text-white focus:outline-none focus:border-gemini-borderLight"
              >
                <option value="uncensored">uncensored</option>
                <option value="light safeguard">light safeguard</option>
                <option value="default safeguard">default safeguard</option>
                <option value="high safeguard">high safeguard</option>
                <option value="max safeguard">max safeguard</option>
              </select>
            </div>

            {/* Temperature */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-gemini-textMuted">Temperature: {form.temperature ?? 0.7}</span>
                <span className="text-gemini-textDim">
                  {form.temperature < 0.4 ? 'Precise' : form.temperature > 0.9 ? 'Creative' : 'Balanced'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={form.temperature ?? 0.7}
                onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
            </div>

            {/* Top-P (Nucleus Sampling) */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-gemini-textMuted">Top-P: {form.topP ?? 0.9}</span>
                <span className="text-gemini-textDim">
                  {(form.topP ?? 0.9) < 0.5 ? 'Focused' : (form.topP ?? 0.9) > 0.9 ? 'Diverse' : 'Standard'}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={form.topP ?? 0.9}
                onChange={(e) => setForm({ ...form, topP: parseFloat(e.target.value) })}
                className="w-full accent-white cursor-pointer"
              />
            </div>

            {/* Top-K Sampling */}
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-gemini-textMuted">Top-K: {form.topK ?? 40}</span>
                <span className="text-gemini-textDim">
                  {(form.topK ?? 40) <= 20 ? 'Narrow' : (form.topK ?? 40) >= 80 ? 'Broad' : 'Standard'}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={form.topK ?? 40}
                onChange={(e) => setForm({ ...form, topK: parseInt(e.target.value, 10) })}
                className="w-full accent-white cursor-pointer"
              />
            </div>

            {/* Context Window */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gemini-textMuted mb-1">
                Context Length (Tokens)
              </label>
              <select
                value={form.contextLength || 4096}
                onChange={(e) => setForm({ ...form, contextLength: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-xl bg-gemini-surface border border-gemini-border text-xs text-white focus:outline-none focus:border-gemini-borderLight"
              >
                <option value={2048}>2,048 tokens</option>
                <option value={4096}>4,096 tokens</option>
                <option value={8192}>8,192 tokens</option>
                <option value={16384}>16,384 tokens</option>
                <option value={32768}>32,768 tokens</option>
                <option value={65536}>65,536 tokens</option>
              </select>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-xs font-medium text-gemini-textMuted mb-1">
                Default System Prompt
              </label>
              <textarea
                rows={3}
                value={form.systemPrompt || ''}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                placeholder="Set instructions for the model..."
                className="w-full p-2.5 rounded-xl bg-gemini-surface border border-gemini-border text-xs text-white focus:outline-none focus:border-gemini-borderLight leading-relaxed"
              />
            </div>
          </div>

          {/* Resource Folders (Ground Truth) */}
          <div className="pt-2 border-t border-gemini-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-1">
              Resource Folders (Ground Truth)
            </h3>
            <p className="text-[11px] text-gemini-textDim mb-3 leading-relaxed">
              Local folders used by the AI to find verified facts and documentation. Prevents hallucinations and misinformation.
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newFolderPath}
                onChange={(e) => {
                  setNewFolderPath(e.target.value);
                  if (folderError) setFolderError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddFolder();
                  }
                }}
                placeholder="Folder path (e.g. C:\Users\Noah\Documents\resources)"
                className="flex-1 px-3 py-2 rounded-xl bg-gemini-surface border border-gemini-border text-xs text-white focus:outline-none focus:border-gemini-borderLight font-mono"
              />
              <button
                type="button"
                onClick={handleAddFolder}
                disabled={isAddingFolder || !newFolderPath.trim()}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-gemini-text hover:text-white transition-colors disabled:opacity-40"
              >
                {isAddingFolder ? 'Adding...' : 'Add'}
              </button>
            </div>

            {folderError && (
              <p className="text-xs text-red-400 mb-2 font-mono">{folderError}</p>
            )}

            <div className="space-y-1.5 mt-2">
              {folderDetails.length === 0 ? (
                <div className="p-3 rounded-xl bg-gemini-surface/40 border border-gemini-border/50 text-[11px] text-gemini-textDim text-center">
                  No resource folders added.
                </div>
              ) : (
                folderDetails.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gemini-surface border border-gemini-border text-xs"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-mono text-white truncate text-[11px]" title={f.path}>
                        {f.path}
                      </div>
                      <div className="text-[10px] text-gemini-textDim mt-0.5">
                        {f.exists ? `${f.fileCount || 0} indexed files` : 'Folder not found'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFolder(f.path)}
                      className="px-2.5 py-1 text-xs rounded-lg hover:bg-gemini-hover text-gemini-textMuted hover:text-red-400 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* History Management */}
          <div className="pt-2 border-t border-gemini-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-3">
              Data & History
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportHistory}
                className="px-3.5 py-2 rounded-xl bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-xs text-gemini-text hover:text-white transition-colors"
              >
                Export History
              </button>

              <label className="px-3.5 py-2 rounded-xl bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-xs text-gemini-text hover:text-white transition-colors cursor-pointer inline-flex items-center">
                Import History
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportHistory}
                  className="hidden"
                />
              </label>

              {confirmClear ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 border border-red-800/50">
                  <span className="text-xs text-red-300">Delete all chats?</span>
                  <button
                    onClick={() => {
                      onClearAllChats();
                      setConfirmClear(false);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-gemini-surface hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="px-3.5 py-2 rounded-xl bg-gemini-surface hover:bg-red-950/30 border border-gemini-border hover:border-red-800/40 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-3 border-t border-gemini-border bg-gemini-surface/30">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-xl bg-gemini-surface hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold rounded-xl bg-white hover:bg-neutral-200 text-black transition-all"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <span>Save</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
