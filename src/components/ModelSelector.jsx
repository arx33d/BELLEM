import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Cpu,
  Search,
  RefreshCw,
  PlusCircle,
  Eye,
  Brain,
  Wrench,
  Check
} from 'lucide-react';

export default function ModelSelector({
  models = [],
  selectedModel,
  onSelectModel,
  onRefresh,
  onOpenModelManager,
  isRefreshing
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeModelObj = models.find(m => m.name === selectedModel);

  const filteredModels = models.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.family && m.family.toLowerCase().includes(search.toLowerCase()))
  );

  const formatSize = (bytes) => {
    if (!bytes) return '';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gemini-surface border border-gemini-border hover:border-gemini-borderLight hover:bg-gemini-hover transition-all text-sm font-medium"
      >
        <span className="text-gemini-text font-semibold truncate max-w-[170px]">
          {selectedModel || 'Select a Model'}
        </span>
        {activeModelObj?.parameterSize && (
          <span className="text-[11px] px-1.5 py-0.5 rounded bg-gemini-surface-variant text-gemini-blueLight border border-gemini-border">
            {activeModelObj.parameterSize}
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-gemini-textMuted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 md:w-96 rounded-2xl bg-[#1e1f20] border border-gemini-border shadow-gemini z-50 overflow-hidden animate-fade-in">
          {/* Header & Search */}
          <div className="p-3 border-b border-gemini-border space-y-2">
            <div className="flex items-center justify-between text-xs text-gemini-textMuted font-medium">
              <span>LOCAL MODELS ({models.length})</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  className="p-1 rounded hover:bg-gemini-hover text-gemini-textMuted hover:text-white transition-colors"
                  title="Refresh models list"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gemini-textDim" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gemini-surface border border-gemini-border text-xs text-gemini-text placeholder:text-gemini-textDim focus:outline-none focus:border-gemini-blue"
              />
            </div>
          </div>

          {/* Model List */}
          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center text-xs text-gemini-textDim">
                No local models found matching "{search}"
              </div>
            ) : (
              filteredModels.map((m) => {
                const isSelected = m.name === selectedModel;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onSelectModel(m.name);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start justify-between ${
                      isSelected
                        ? 'bg-gemini-blue/15 border border-gemini-blue/40 text-white'
                        : 'hover:bg-gemini-hover text-gemini-text border border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">{m.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-gemini-blueLight flex-shrink-0" />}
                      </div>

                      {/* Specs badges */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-gemini-textMuted">
                        {m.parameterSize && (
                          <span className="px-1.5 py-0.2 rounded bg-[#282a2c] text-gemini-blueLight">
                            {m.parameterSize}
                          </span>
                        )}
                        {m.quantization && (
                          <span className="px-1.5 py-0.2 rounded bg-[#282a2c] text-gemini-textDim">
                            {m.quantization}
                          </span>
                        )}
                        {m.size && (
                          <span className="text-gemini-textDim">
                            {formatSize(m.size)}
                          </span>
                        )}
                        {m.contextLength && (
                          <span className="text-gemini-textDim">
                            {(m.contextLength / 1024).toFixed(0)}k ctx
                          </span>
                        )}
                      </div>

                      {/* Capabilities badges */}
                      {m.capabilities && m.capabilities.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5">
                          {m.capabilities.includes('vision') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#282a2c] text-gemini-textMuted border border-gemini-border">
                              Vision
                            </span>
                          )}
                          {m.capabilities.includes('thinking') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#282a2c] text-gemini-textMuted border border-gemini-border">
                              Reasoning
                            </span>
                          )}
                          {m.capabilities.includes('tools') && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#282a2c] text-gemini-textMuted border border-gemini-border">
                              Tools
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Action: Pull new model */}
          <div className="p-2 border-t border-gemini-border bg-gemini-surface/50">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenModelManager();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-gemini-blueLight hover:bg-gemini-hover transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              Manage & Download Models
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
