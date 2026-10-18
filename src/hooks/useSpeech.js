import { useState, useEffect, useCallback } from 'react';

export function useSpeech() {
  const [speakingId, setSpeakingId] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    }
  }, []);

  const speak = useCallback((messageId, text) => {
    if (!isSupported) return;

    if (speakingId === messageId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    // Clean markdown formatting and tags for speech
    const cleanText = text
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/[#*_~>]/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      setSpeakingId(null);
    };

    utterance.onerror = () => {
      setSpeakingId(null);
    };

    setSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  }, [isSupported, speakingId, stopSpeaking]);

  return {
    isSupported,
    speakingId,
    speak,
    stopSpeaking
  };
}
