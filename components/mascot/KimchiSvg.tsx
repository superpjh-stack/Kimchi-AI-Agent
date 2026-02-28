'use client';

import React from 'react';
import type { MascotState } from '@/types/mascot';
import { SeasonalSvgLayer, getCurrentSeason } from './seasonal/SeasonalOverlay';

interface KimchiSvgProps {
  state: MascotState;
  size?: number;
  className?: string;
  onClick?: () => void;
}

const KimchiSvg = React.memo(function KimchiSvg({
  state,
  size = 60,
  className = '',
  onClick,
}: KimchiSvgProps) {
  // 상태별 입 모양 path
  const mouthPath: Record<MascotState, string> = {
    idle:        'M 22 38 Q 30 43 38 38',   // 미소
    thinking:    'M 24 39 Q 30 37 36 39',   // 일자
    success:     'M 22 36 Q 30 45 38 36',   // 활짝 웃음
    error:       'M 24 42 Q 30 38 36 42',   // 찡그림
    celebrating: 'M 20 36 Q 30 48 40 36',  // 크게 벌린 입
    searching:   'M 25 38 Q 30 41 35 38',  // 오 모양
    sleeping:    'M 24 40 L 36 40',         // 일자 (잠)
  };

  const renderEyes = () => {
    if (state === 'sleeping') {
      return (
        <>
          <path d="M 20 28 Q 24 26 28 28" stroke="#2D1810" strokeWidth="2"
                fill="none" strokeLinecap="round" />
          <path d="M 32 28 Q 36 26 40 28" stroke="#2D1810" strokeWidth="2"
                fill="none" strokeLinecap="round" />
        </>
      );
    }
    if (state === 'error') {
      return (
        <>
          <line x1="21" y1="25" x2="27" y2="31" stroke="#2D1810" strokeWidth="2" strokeLinecap="round" />
          <line x1="27" y1="25" x2="21" y2="31" stroke="#2D1810" strokeWidth="2" strokeLinecap="round" />
          <line x1="33" y1="25" x2="39" y2="31" stroke="#2D1810" strokeWidth="2" strokeLinecap="round" />
          <line x1="39" y1="25" x2="33" y2="31" stroke="#2D1810" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    }
    return (
      <>
        <circle cx="24" cy="28" r="3" fill="#2D1810">
          <animate attributeName="ry" values="3;0.5;3" dur="3s"
                   repeatCount="indefinite" begin="0s"
                   keyTimes="0;0.03;0.06" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                   calcMode="spline" />
        </circle>
        <circle cx="36" cy="28" r="3" fill="#2D1810">
          <animate attributeName="ry" values="3;0.5;3" dur="3s"
                   repeatCount="indefinite" begin="0s"
                   keyTimes="0;0.03;0.06" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                   calcMode="spline" />
        </circle>
        <circle cx="25.5" cy="26.5" r="1" fill="white" opacity="0.8" />
        <circle cx="37.5" cy="26.5" r="1" fill="white" opacity="0.8" />
      </>
    );
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`kimchi-mascot kimchi-mascot--${state} ${className}${onClick ? ' cursor-pointer' : ''}`}
      role="img"
      aria-hidden="true"
      onClick={onClick}
      style={onClick ? { pointerEvents: 'all' } : undefined}
    >
      {/* 잎사귀 3장 */}
      <ellipse cx="22" cy="10" rx="6" ry="10" fill="#52B788"
               transform="rotate(-20 22 10)" opacity="0.9" />
      <ellipse cx="30" cy="8" rx="5" ry="11" fill="#2A9D8F" />
      <ellipse cx="38" cy="10" rx="6" ry="10" fill="#52B788"
               transform="rotate(20 38 10)" opacity="0.9" />

      {/* 몸통 (배추 형태) */}
      <ellipse cx="30" cy="34" rx="16" ry="20" fill="#F5E6CA" />
      <ellipse cx="30" cy="34" rx="16" ry="20" fill="none"
               stroke="#2A9D8F" strokeWidth="1.5" opacity="0.4" />
      <path d="M 22 20 Q 30 25 38 20" stroke="#EAD2AC" strokeWidth="1"
            fill="none" opacity="0.5" />
      <path d="M 20 28 Q 30 33 40 28" stroke="#EAD2AC" strokeWidth="1"
            fill="none" opacity="0.3" />

      {/* 볼터치 */}
      <circle cx="18" cy="33" r="3.5" fill="#E85D5D" opacity="0.3" />
      <circle cx="42" cy="33" r="3.5" fill="#E85D5D" opacity="0.3" />

      {/* 눈 */}
      {renderEyes()}

      {/* 입 */}
      <path d={mouthPath[state]} stroke="#2D1810" strokeWidth="1.8"
            fill="none" strokeLinecap="round" />

      {/* 팔 (왼) */}
      <path d="M 14 32 Q 8 30 6 26" stroke="#F5E6CA" strokeWidth="3"
            strokeLinecap="round" fill="none"
            className="kimchi-mascot__arm-left" />

      {/* 팔 (오) */}
      <path d="M 46 32 Q 52 30 54 26" stroke="#F5E6CA" strokeWidth="3"
            strokeLinecap="round" fill="none"
            className="kimchi-mascot__arm-right" />

      {/* 다리 */}
      <line x1="24" y1="52" x2="22" y2="58" stroke="#EAD2AC"
            strokeWidth="3" strokeLinecap="round" />
      <line x1="36" y1="52" x2="38" y2="58" stroke="#EAD2AC"
            strokeWidth="3" strokeLinecap="round" />

      {/* searching 상태: 돋보기 */}
      {state === 'searching' && (
        <g transform="translate(44, 18) rotate(30)">
          <circle cx="0" cy="0" r="5" fill="none" stroke="#F77F00" strokeWidth="1.5" />
          <line x1="3.5" y1="3.5" x2="8" y2="8" stroke="#F77F00"
                strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {/* sleeping 상태: Zzz — 5개 float 파티클 */}
      {state === 'sleeping' && (
        <g className="kimchi-mascot__zzz">
          <text x="42" y="20" fontSize="9" fill="#A8907A" fontWeight="bold" opacity="0.8">Z</text>
          <text x="46" y="14" fontSize="7" fill="#A8907A" fontWeight="bold" opacity="0.65">z</text>
          <text x="49" y="9"  fontSize="6" fill="#A8907A" fontWeight="bold" opacity="0.5">z</text>
          <text x="52" y="5"  fontSize="5" fill="#A8907A" fontWeight="bold" opacity="0.35">z</text>
          <text x="54" y="2"  fontSize="4" fill="#A8907A" fontWeight="bold" opacity="0.2">z</text>
        </g>
      )}

      {/* 계절 오버레이 */}
      <SeasonalSvgLayer season={getCurrentSeason()} />

      {/* 클릭 리플 원 */}
      {onClick && (
        <circle
          cx="30" cy="34" r="18"
          fill="none"
          stroke="#D62828"
          strokeWidth="2"
          opacity="0"
          className="kimchi-mascot__ripple"
        />
      )}
    </svg>
  );
});

export default KimchiSvg;
