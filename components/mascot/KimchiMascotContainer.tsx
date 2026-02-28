'use client';

import { motion } from 'framer-motion';
import KimchiSvg from './KimchiSvg';
import MascotSpeech from './MascotSpeech';
import MascotToggle from './MascotToggle';
import { useMascot } from '@/hooks/useMascot';
import { useMascotTrigger } from '@/hooks/useMascotTrigger';

// 봄 물리 설정 — 부드럽고 자연스러운 비행감
const SPRING = { type: 'spring', stiffness: 45, damping: 9, mass: 1.3 } as const;

export default function KimchiMascotContainer() {
  const {
    state,
    phrase,
    showSpeech,
    settings,
    position,
    setState,
    dismissSpeech,
    toggleEnabled,
    toggleSpeech,
  } = useMascot();

  // 글로벌 이벤트 수신 → useMascot 상태 변경
  useMascotTrigger(setState);

  // OFF 상태이면 토글 버튼만 표시 (비행 없이 고정)
  if (!settings.enabled) {
    return (
      <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50">
        <MascotToggle
          enabled={false}
          onToggle={toggleEnabled}
        />
      </div>
    );
  }

  return (
    <motion.div
      className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50
                 flex flex-col items-end gap-1"
      animate={{ x: position.x, y: position.y }}
      transition={SPRING}
      role="complementary"
      aria-label="김치군 마스코트"
    >
      {/* 말풍선 */}
      {showSpeech && phrase && settings.speechEnabled && (
        <MascotSpeech
          text={phrase.text}
          emoji={phrase.emoji}
          onDismiss={dismissSpeech}
        />
      )}

      {/* 캐릭터 */}
      <div className="relative">
        <KimchiSvg
          state={state}
          size={60}
          className="w-[40px] h-[40px] md:w-[60px] md:h-[60px]"
        />

        {/* ON/OFF 토글 — 캐릭터 좌상단 */}
        <div className="absolute -top-1 -left-1">
          <MascotToggle
            enabled={true}
            speechEnabled={settings.speechEnabled}
            onToggle={toggleEnabled}
            onSpeechToggle={toggleSpeech}
          />
        </div>
      </div>
    </motion.div>
  );
}
