import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import ChatMessage from './ChatMessage';

export default function ChatArea({
  messages = [],
  isStreaming = false,
  selectedModel,
  onSendMessage,
  onRegenerate,
  onEditMessage,
  speakingId,
  onToggleSpeak
}) {
  const scrollRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const userScrolledUpRef = useRef(false);

  // Handle scroll events to detect if user manually scrolled up
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 120;
    setShowScrollBottom(isUp);
    userScrolledUpRef.current = isUp;
  };

  // Scroll to bottom smoothly
  const scrollToBottom = (behavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
      userScrolledUpRef.current = false;
      setShowScrollBottom(false);
    }
  };

  // Auto-scroll on new messages or during streaming if user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom('auto');
    }
  }, [messages, isStreaming]);

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* Scrollable messages container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
      >
        {messages.length === 0 ? (
          /* Clean Minimal Start */
          <div className="min-h-full flex items-center justify-center select-none">
            <div className="text-2xl font-bold tracking-widest text-gemini-textDim/30 font-mono">
              BELLEM
            </div>
          </div>
        ) : (
          /* Conversation Message Feed */
          <div className="pb-8">
            {messages.map((msg, index) => {
              const isLast = index === messages.length - 1;
              return (
                <ChatMessage
                  key={msg.id || index}
                  message={msg}
                  isStreaming={isStreaming && isLast && msg.role === 'assistant'}
                  onRegenerate={
                    !isStreaming && isLast && msg.role === 'assistant'
                      ? onRegenerate
                      : undefined
                  }
                  onEditMessage={onEditMessage}
                  isSpeaking={speakingId === msg.id}
                  onToggleSpeak={() => onToggleSpeak(msg.id, msg.content)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom button */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-4 right-8 p-2.5 rounded-full bg-gemini-surface hover:bg-gemini-hover border border-gemini-border text-gemini-text hover:text-white shadow-gemini transition-all z-20 flex items-center gap-1.5 text-xs font-medium"
        >
          <ArrowDown className="w-4 h-4 text-gemini-blueLight" />
          <span>Scroll down</span>
        </button>
      )}
    </div>
  );
}
