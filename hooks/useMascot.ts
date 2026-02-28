'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { MascotState, MascotPhrase, MascotSettings } from '@/types/mascot';
import { getRandomPhrase } from '@/components/mascot/mascot-phrases';

const STORAGE_KEY = 'kimchi-mascot-settings';
const DEFAULT_SETTINGS: MascotSettings = { enabled: true, speechEnabled: true };

const STATE_RESET_DELAY: Record<MascotState, number> = {
  idle: 0,
  thinking: 0,       // thinking은 자동 해제 안 함 (done 이벤트로 전환)
  success: 3000,
  error: 3000,
  celebrating: 3000,
  searching: 0,      // searching도 자동 해제 안 함
  sleeping: 0,       // sleeping도 자동 해제 안 함
};

function loadSettings(): MascotSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: MascotSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

export function useMascot() {
  const [state, setStateInternal] = useState<MascotState>('idle');
  const [phrase, setPhrase] = useState<MascotPhrase | null>(null);
  const [showSpeech, setShowSpeech] = useState(false);
  const [settings, setSettings] = useState<MascotSettings>(DEFAULT_SETTINGS);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마운트 시 설정 로드 + 야간 체크
  useEffect(() => {
    setSettings(loadSettings());
    const hour = new Date().getHours();
    if (hour >= 22 || hour < 6) {
      setStateInternal('sleeping');
      setPhrase(getRandomPhrase('sleeping'));
      setShowSpeech(true);
    }
  }, []);

  const setState = useCallback((newState: MascotState, forcedPhrase?: string) => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setStateInternal(newState);

    if (forcedPhrase) {
      setPhrase({ text: forcedPhrase });
    } else {
      setPhrase(getRandomPhrase(newState));
    }
    setShowSpeech(true);

    const delay = STATE_RESET_DELAY[newState];
    if (delay > 0) {
      resetTimerRef.current = setTimeout(() => {
        setStateInternal('idle');
        setShowSpeech(false);
        resetTimerRef.current = null;
      }, delay);
    }
  }, []);

  const dismissSpeech = useCallback(() => {
    setShowSpeech(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      saveSettings(next);
      return next;
    });
  }, []);

  const toggleSpeech = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev, speechEnabled: !prev.speechEnabled };
      saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  return {
    state,
    phrase,
    showSpeech,
    settings,
    setState,
    dismissSpeech,
    toggleEnabled,
    toggleSpeech,
  };
}
