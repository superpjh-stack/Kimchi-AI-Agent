'use client';

import type { Season } from '@/types/mascot';

interface SeasonalSvgLayerProps {
  season: Season;
}

/**
 * 계절별 SVG 오버레이 — KimchiSvg 내부에서 동일 viewBox(0 0 60 60)로 삽입
 * spring: 벚꽃 파티클 / summer: 선글라스 / autumn: 단풍잎 / winter: 산타모자
 */
export function SeasonalSvgLayer({ season }: SeasonalSvgLayerProps) {
  if (season === 'spring') {
    return (
      <g className="seasonal-spring" aria-hidden="true">
        <circle cx="7"  cy="16" r="3"   fill="#FFB7C5" opacity="0.85" />
        <circle cx="14" cy="10" r="2.5" fill="#FFB7C5" opacity="0.75" />
        <circle cx="4"  cy="24" r="2"   fill="#FFC0CB" opacity="0.60" />
        <circle cx="50" cy="13" r="3"   fill="#FFB7C5" opacity="0.85" />
        <circle cx="44" cy="7"  r="2.5" fill="#FFB7C5" opacity="0.75" />
      </g>
    );
  }

  if (season === 'summer') {
    return (
      <g className="seasonal-summer" aria-hidden="true">
        {/* 왼쪽 렌즈 */}
        <rect x="16" y="24" width="11" height="7" rx="3.5" fill="#1A1A2E" opacity="0.88" />
        {/* 오른쪽 렌즈 */}
        <rect x="33" y="24" width="11" height="7" rx="3.5" fill="#1A1A2E" opacity="0.88" />
        {/* 브릿지 */}
        <line x1="27" y1="27.5" x2="33" y2="27.5" stroke="#1A1A2E" strokeWidth="1.5" />
        {/* 렌즈 반사 하이라이트 */}
        <circle cx="20" cy="26" r="1.3" fill="white" opacity="0.35" />
        <circle cx="37" cy="26" r="1.3" fill="white" opacity="0.35" />
      </g>
    );
  }

  if (season === 'autumn') {
    return (
      <g className="seasonal-autumn" aria-hidden="true">
        {/* 단풍잎 — 작은 별/오각형 */}
        <polygon
          points="8,19 9.8,14 11.6,19 6.5,16 11.5,16"
          fill="#D62828" opacity="0.82"
        />
        <polygon
          points="49,15 50.8,10 52.6,15 47.5,12 52.5,12"
          fill="#F77F00" opacity="0.82"
        />
        <polygon
          points="4,30 5.8,25 7.6,30 2.5,27 7.5,27"
          fill="#D62828" opacity="0.60"
        />
      </g>
    );
  }

  if (season === 'winter') {
    return (
      <g className="seasonal-winter" aria-hidden="true">
        {/* 산타모자 본체 */}
        <path d="M 18 17 Q 22 3 30 1.5 Q 38 3 42 17 Z" fill="#D62828" />
        {/* 흰 트림 */}
        <ellipse cx="30" cy="17" rx="12" ry="3.5" fill="white" />
        {/* 방울 */}
        <circle cx="30" cy="1.5" r="2.8" fill="white" />
      </g>
    );
  }

  return null;
}

/** 현재 날짜 기준으로 계절 반환 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1; // 1~12
  if (month >= 3 && month <= 5)  return 'spring';
  if (month >= 6 && month <= 8)  return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}
