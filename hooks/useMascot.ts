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

// 비행 위치 계산 (bottom-right 기준 음수 offset)
function getRandomFlyTarget(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return { x: 0, y: 0 };
  const maxDx = window.innerWidth - 100;
  const maxDy = window.innerHeight - 100;
  return {
    x: -(Math.random() * maxDx * 0.7 + maxDx * 0.1),
    y: -(Math.random() * maxDy * 0.7 + maxDy * 0.1),
  };
}

// 상태별 비행 여부 — idle/sleeping은 홈으로 복귀
const SHOULD_FLY: Record<MascotState, boolean> = {
  idle: false,
  sleeping: false,
  thinking: true,
  success: true,
  error: true,
  celebrating: true,
  searching: true,
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
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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
    // 기존 타이머 초기화
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    flyTimersRef.current.forEach(clearTimeout);
    flyTimersRef.current = [];

    setStateInternal(newState);

    if (forcedPhrase) {
      setPhrase({ text: forcedPhrase });
    } else {
      setPhrase(getRandomPhrase(newState));
    }
    setShowSpeech(true);

    // 비행 로직
    if (SHOULD_FLY[newState]) {
      if (newState === 'celebrating') {
        // 축하 상태: 3곳 순차 비행
        setPosition(getRandomFlyTarget());
        const t1 = setTimeout(() => setPosition(getRandomFlyTarget()), 700);
        const t2 = setTimeout(() => setPosition(getRandomFlyTarget()), 1400);
        flyTimersRef.current = [t1, t2];
      } else {
        setPosition(getRandomFlyTarget());
      }
    } else {
      // idle / sleeping → 홈으로 복귀
      setPosition({ x: 0, y: 0 });
    }

    const delay = STATE_RESET_DELAY[newState];
    if (delay > 0) {
      resetTimerRef.current = setTimeout(() => {
        setStateInternal('idle');
        setShowSpeech(false);
        setPosition({ x: 0, y: 0 }); // 홈 복귀
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
      flyTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  return {
    state,
    phrase,
    showSpeech,
    settings,
    position,
    setState,
    dismissSpeech,
    toggleEnabled,
    toggleSpeech,
  };
}
