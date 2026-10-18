import React, { useState } from 'react';
import {
  X,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { pullModel, deleteModel } from '../utils/api';

const POPULAR_MODELS = [
  { name: 'llama3.2', tag: '3B', desc: 'Fast general chat by Meta' },
  { name: 'dolphin-llama3:8b', tag: '8B', desc: 'Uncensored general assistant' },
  { name: 'deepseek-r1:8b', tag: '8B', desc: 'Reasoning and logic specialist' },
  { name: 'qwen2.5-coder:7b', tag: '7B', desc: 'Code generation and review' },
  { name: 'mistral', tag: '7B', desc: 'General purpose assistant' },
  { name: 'phi4', tag: '14B', desc: 'High performance reasoning' }
];

export default function ModelManagerModal({
  isOpen,
  onClose,
  models = [],
  onModelsChanged
}) {
  const [modelInput, setModelInput] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState(null);
  const [pullError, setPullError] = useState(null);
  const [deletingName, setDeletingName] = useState(null);
  const [confirmDeleteModel, setConfirmDeleteModel] = useState(null);

  if (!isOpen) return null;

  const handlePull = async (targetModel) => {
    const name = (targetModel || modelInput).trim();
    if (!name || isPulling) return;

    setIsPulling(true);
    setPullError(null);
    setPullProgress({ status: 'Starting download...', percent: 0 });

    try {
      await pullModel(name, (data) => {
        if (data.total && data.completed) {
          const percent = Math.round((data.completed / data.total) * 100);
          const completedMB = (data.completed / (1024 * 1024)).toFixed(0);
          const totalMB = (data.total / (1024 * 1024)).toFixed(0);
          setPullProgress({
            status: data.status || 'Downloading...',
            percent,
            detail: `${completedMB} MB / ${totalMB} MB (${percent}%)`
          });
        } else {
          setPullProgress({
            status: data.status || 'Processing...',
            percent: 100
          });
        }
      });

      setPullProgress({ status: 'Download complete', percent: 100, done: true });
      setModelInput('');
      if (onModelsChanged) onModelsChanged();
      setTimeout(() => {
        setIsPulling(false);
        setPullProgress(null);
      }, 2000);
    } catch (err) {
      setPullError(err.message || 'Failed to download model');
      setIsPulling(false);
    }
  };

  const executeDelete = async (name) => {
    setDeletingName(name);
    try {
      await deleteModel(name);
      setConfirmDeleteModel(null);
      if (onModelsChanged) onModelsChanged();
    } catch (err) {
      alert(`Error deleting model: ${err.message}`);
    } finally {
      setDeletingName(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-[#1e1f20] border border-gemini-border rounded-3xl shadow-gemini overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gemini-border">
          <h2 className="text-sm font-bold tracking-wide uppercase text-white font-mono">Model</h2>
          <button
            onClick={onClose}
            disabled={isPulling}
            className="p-1.5 rounded-full hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scroll Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Download New Model Form */}
          <div className="p-4 rounded-2xl bg-gemini-surface border border-gemini-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-2">
              Pull Model
            </h3>
            <p className="text-xs text-gemini-textMuted mb-3">
              Enter any model tag to pull and run it locally.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={modelInput}
                onChange={(e) => setModelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePull()}
                placeholder="e.g. llama3.2, deepseek-r1:8b, mistral..."
                disabled={isPulling}
                className="flex-1 px-3 py-2 rounded-xl bg-[#18191a] border border-gemini-border text-xs text-white placeholder:text-gemini-textDim focus:outline-none focus:border-gemini-borderLight font-mono"
              />
              <button
                onClick={() => handlePull()}
                disabled={!modelInput.trim() || isPulling}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-30 text-black text-xs font-semibold transition-all"
              >
                {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Pull</span>
              </button>
            </div>

            {/* Download Progress Status Bar */}
            {pullProgress && (
              <div className="mt-4 p-3 rounded-xl bg-[#131314] border border-gemini-border">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-mono text-gemini-text flex items-center gap-1.5">
                    {pullProgress.done ? (
                      <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    {pullProgress.status}
                  </span>
                  {pullProgress.detail && (
                    <span className="text-[11px] font-mono text-gemini-textDim">
                      {pullProgress.detail}
                    </span>
                  )}
                </div>
                <div className="w-full h-1.5 bg-gemini-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-300"
                    style={{ width: `${pullProgress.percent || 0}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {pullError && (
              <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{pullError}</span>
              </div>
            )}

            {/* Popular Quick Suggestions */}
            <div className="mt-4 pt-3 border-t border-gemini-border/40">
              <span className="text-[11px] font-medium text-gemini-textDim block mb-2">
                POPULAR
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {POPULAR_MODELS.map((item) => {
                  const alreadyInstalled = models.some(m => m.name === item.name || m.name.startsWith(item.name + ':'));
                  return (
                    <button
                      key={item.name}
                      onClick={() => handlePull(item.name)}
                      disabled={isPulling || alreadyInstalled}
                      className={`text-left p-2.5 rounded-xl border transition-all ${
                        alreadyInstalled
                          ? 'bg-gemini-surface/40 border-gemini-border/40 opacity-60'
                          : 'bg-gemini-surface hover:bg-gemini-hover border border-gemini-border hover:border-gemini-borderLight'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white truncate">{item.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-gemini-surface-variant text-gemini-textDim">
                          {alreadyInstalled ? 'Installed' : item.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-gemini-textDim line-clamp-1">{item.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Currently Installed Models List */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gemini-textDim mb-3">
              Installed Models ({models.length})
            </h3>

            <div className="space-y-2">
              {models.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-gemini-surface border border-gemini-border text-xs text-gemini-textDim">
                  No local models found
                </div>
              ) : (
                models.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-2xl bg-gemini-surface border border-gemini-border flex items-center justify-between hover:border-gemini-borderLight transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{m.name}</span>
                        {m.parameterSize && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-gemini-surface-variant text-gemini-textMuted">
                            {m.parameterSize}
                          </span>
                        )}
                        {m.quantization && (
                          <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#18191a] text-gemini-textDim">
                            {m.quantization}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gemini-textDim">
                        <span>Size: {formatSize(m.size)}</span>
                        {m.contextLength && (
                          <span>Context: {(m.contextLength / 1024).toFixed(0)}k</span>
                        )}
                      </div>
                    </div>

                    {/* Delete Model Action: Custom in-app confirmation button */}
                    {m.provider === 'ollama' && (
                      confirmDeleteModel === m.name ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/40 border border-red-800/50">
                          <span className="text-xs text-red-300">Delete?</span>
                          <button
                            onClick={() => executeDelete(m.name)}
                            disabled={deletingName === m.name}
                            className="px-2 py-0.5 text-xs rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                          >
                            {deletingName === m.name ? 'Deleting...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteModel(null)}
                            disabled={deletingName === m.name}
                            className="px-2 py-0.5 text-xs rounded-lg bg-gemini-surface hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteModel(m.name)}
                          disabled={deletingName === m.name || isPulling}
                          className="p-2 rounded-xl text-gemini-textDim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete model"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-gemini-border bg-gemini-surface/30">
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-medium rounded-xl bg-gemini-surface hover:bg-gemini-hover text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
