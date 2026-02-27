'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

type VoiceState = 'idle' | 'listening' | 'processing';

// Extend Window type for Web Speech API (not yet in TS lib definitions)
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [isSupported, setIsSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognitionAPI) {
      setIsSupported(true);
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceState('listening');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        setVoiceState('processing');
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
        setTimeout(() => setVoiceState('idle'), 300);
      };

      recognition.onerror = () => {
        setVoiceState('idle');
      };

      recognition.onend = () => {
        if (voiceState === 'listening') {
          setVoiceState('idle');
        }
      };

      recognitionRef.current = recognition;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = useCallback(() => {
    if (!recognitionRef.current || disabled) return;

    if (voiceState === 'listening') {
      recognitionRef.current.stop();
      setVoiceState('idle');
    } else if (voiceState === 'idle') {
      try {
        recognitionRef.current.start();
      } catch {
        setVoiceState('idle');
      }
    }
  }, [voiceState, disabled]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || voiceState === 'processing'}
      title={voiceState === 'listening' ? '녹음 중지' : '음성 입력'}
      className={clsx(
        'relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-kimchi-red',
        {
          'bg-gray-100 hover:bg-gray-200 text-gray-500': voiceState === 'idle' && !disabled,
          'bg-kimchi-red text-white recording-pulse': voiceState === 'listening',
          'bg-gray-100 text-gray-400 cursor-not-allowed': voiceState === 'processing' || disabled,
        }
      )}
    >
      {voiceState === 'processing' ? (
        <Loader2 size={18} className="animate-spin" />
      ) : voiceState === 'listening' ? (
        <>
          <Mic size={18} />
          {/* Recording indicator dot */}
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-kimchi-red animate-pulse" />
        </>
      ) : (
        <Mic size={18} />
      )}
    </button>
  );
}
