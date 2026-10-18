import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowUp,
  Square,
  Paperclip,
  X,
  FileText,
  Globe
} from 'lucide-react';
import { uploadFiles } from '../utils/api';

export default function InputBar({
  onSendMessage,
  isStreaming,
  onStopGeneration,
  selectedModel,
  disabled = false,
  onOpenSettings,
  isWebActive = true,
  onToggleWeb
}) {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize textarea and ensure no accidental scrollbar tracks
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(Math.max(scrollHeight, 38), 180);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = scrollHeight > 180 ? 'auto' : 'hidden';
    }
  }, [prompt]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((!prompt.trim() && attachments.length === 0) || isStreaming || disabled) return;

    onSendMessage(prompt.trim(), attachments);
    setPrompt('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '38px';
      textareaRef.current.style.overflowY = 'hidden';
    }
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const res = await uploadFiles(Array.from(files));
      if (res && res.files) {
        setAttachments(prev => [...prev, ...res.files]);
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const canSend = prompt.trim().length > 0 || attachments.length > 0;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pb-4 pt-2">
      {/* Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-3xl bg-gemini-surface border transition-all duration-200 shadow-gemini ${
          isDragging
            ? 'border-gemini-blue bg-gemini-surface/90 ring-2 ring-gemini-blue/30'
            : 'border-gemini-border focus-within:border-gemini-borderLight focus-within:shadow-glow'
        }`}
      >
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1 border-b border-gemini-border/40">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-gemini-surface-variant border border-gemini-border text-xs text-gemini-text group"
              >
                {att.type === 'image' ? (
                  <div className="w-5 h-5 rounded overflow-hidden">
                    <img
                      src={att.previewUrl || `data:image/jpeg;base64,${att.base64}`}
                      alt={att.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <FileText className="w-4 h-4 text-gemini-blueLight" />
                )}
                <span className="truncate max-w-[140px] font-mono text-[11px]">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="p-0.5 rounded-full hover:bg-gemini-hover text-gemini-textMuted hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-center gap-1.5 px-3 py-1.5">
          {/* File Attachment Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || isStreaming}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gemini-textMuted hover:text-white hover:bg-gemini-hover transition-colors disabled:opacity-40 shrink-0"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.txt,.md,.py,.js,.jsx,.ts,.tsx,.json,.csv,.html,.css,.log,.yml,.yaml,.sql"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
          />

          {/* Web Search & Analysis Toggle Button */}
          {onToggleWeb && (
            <button
              type="button"
              onClick={onToggleWeb}
              disabled={isStreaming}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                isWebActive
                  ? 'text-gemini-blueLight bg-gemini-blue/15 hover:bg-gemini-blue/25'
                  : 'text-gemini-textDim hover:text-white hover:bg-gemini-hover'
              }`}
              title={isWebActive ? 'Web Search & Deep Website Analysis: ON' : 'Web Search & Deep Website Analysis: OFF'}
            >
              <Globe className="w-4 h-4" />
            </button>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedModel
                ? `Ask ${selectedModel}...`
                : 'Select a model to start chatting...'
            }
            disabled={disabled}
            className="flex-1 max-h-[180px] py-2 px-2 bg-transparent text-gemini-text placeholder:text-gemini-textDim text-[14px] resize-none focus:outline-none leading-relaxed no-scrollbar overflow-hidden"
          />

          {/* Action button: Send or Stop */}
          <div className="shrink-0 flex items-center justify-center">
            {isStreaming ? (
              <button
                type="button"
                onClick={onStopGeneration}
                className="w-8 h-8 rounded-full bg-white text-black hover:bg-neutral-200 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
                title="Stop generation"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSend || disabled || isUploading}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  canSend
                    ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-sm active:scale-95'
                    : 'bg-white/10 text-gemini-textDim/40 cursor-not-allowed'
                }`}
                title="Send message"
              >
                <ArrowUp className="w-4 h-4 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
