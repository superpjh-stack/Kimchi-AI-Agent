'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { stripMarkdown } from '@/lib/utils/markdown';

interface UseTextToSpeechOptions {
  lang?: string;
}

interface UseTextToSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voiceMode: boolean;
  setVoiceMode: (on: boolean) => void;
}

/**
 * Split text into chunks of up to maxLen characters at sentence boundaries.
 * Workaround for Chrome's ~15-second SpeechSynthesis bug.
 */
function splitIntoChunks(text: string, maxLen = 200): string[] {
  const chunks: string[] = [];
  // Split on sentence-ending punctuation while keeping the delimiter
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

function pickKoreanVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  // Prefer exact match, then language prefix, then any available
  return (
    voices.find((v) => v.lang === lang) ??
    voices.find((v) => v.lang.startsWith('ko')) ??
    voices[0] ??
    null
  );
}

export function useTextToSpeech({ lang = 'ko-KR' }: UseTextToSpeechOptions = {}): UseTextToSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const chunksRef = useRef<string[]>([]);
  const chunkIndexRef = useRef(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    setIsSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        cancelledRef.current = true;
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakChunk = useCallback((chunks: string[], index: number) => {
    if (cancelledRef.current || index >= chunks.length) {
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    utterance.lang = lang;

    // Pick Korean voice if available
    const voices = window.speechSynthesis.getVoices();
    const voice = pickKoreanVoice(voices, lang);
    if (voice) utterance.voice = voice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      if (!cancelledRef.current) {
        speakChunk(chunks, index + 1);
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [lang]);

  const speak = useCallback((text: string) => {
    if (!isSupported) return;

    // Cancel any ongoing speech
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    cancelledRef.current = false;

    const plain = stripMarkdown(text);
    if (!plain) return;

    const chunks = splitIntoChunks(plain);
    chunksRef.current = chunks;
    chunkIndexRef.current = 0;

    setIsSpeaking(true);

    // Chrome requires a tiny delay after cancel() before speaking again
    setTimeout(() => {
      if (!cancelledRef.current) {
        speakChunk(chunks, 0);
      }
    }, 50);
  }, [isSupported, speakChunk]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported, voiceMode, setVoiceMode };
}
