# 김치군 마스코트 창의적 UI/UX 설계서

**버전**: v1.0
**작성일**: 2026-02-28
**상태**: Draft
**연관 Plan**: `docs/01-plan/features/kimchi-agent-phase6.plan.md`

---

## 1. 개요

현재 김치군 마스코트는 60×60px SVG 캐릭터로 화면 우하단에 고정되어 있으며, 7가지 감정 상태와 말풍선 대사, Framer Motion spring 물리 비행을 제공한다. 이 설계서는 레벨 시스템, 계절 의상, 인터랙션 강화, 성취 배지, 야간 모드 파티클 등 5가지 창의적 확장 UI를 정의한다.

### 현재 아키텍처 기반 정보

```
KimchiMascotContainer (fixed bottom-right, z-50)
├── MascotSpeech (말풍선, 3500ms 자동 해제)
├── KimchiSvg (60px SVG, 7 MascotState)
└── MascotToggle (ON/OFF, 캐릭터 좌상단 -top-1 -left-1)

useMascot hook:
├── state: MascotState
├── position: {x, y} — Framer Motion animate target
├── settings: {enabled, speechEnabled}
└── phrase: MascotPhrase | null

Custom Events: window 'kimchi-mascot' → useMascotTrigger → useMascot.setState()
```

---

## 2. 레벨 표시 배지 시스템

### 2.1 레벨 정의

| 레벨 | 이름 | 아이콘 | 조건 (상호작용 누적) | 색상 |
|------|------|--------|---------------------|------|
| 1 | 씨앗君 | 🌱 | 0~9 회 | #8BC34A 연두 |
| 2 | 배추君 | 🥬 | 10~49 회 | #52B788 초록 |
| 3 | 파김치君 | 🌿 | 50~199 회 | #2A9D8F 청록 |
| 4 | 숙성김치君 | 🔴 | 200+ 회 | #E63946 진홍 |

상호작용 = 채팅 전송 1회 + 문서 업로드 1회 = 각 1 포인트 적산 (localStorage `kimchi-level-count` 키)

### 2.2 배지 위치 — 캐릭터 우하단

```
+---------------------------+
|                           |
|   [ KimchiSvg 60×60px ]   |
|                      ┌──┐ |
|                      │🌱│ |  ← 배지 (20×20px, 원형)
|                      │ 1│ |
|                      └──┘ |
+---------------------------+
```

**CSS 위치**: `absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4`

배지 컴포넌트 구조:

```tsx
// components/mascot/LevelBadge.tsx
<div
  className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4
             w-5 h-5 rounded-full border-2 border-white shadow-md
             flex items-center justify-center
             text-[9px] font-bold select-none"
  style={{ background: LEVEL_COLORS[level] }}
  aria-label={`레벨 ${level}: ${LEVEL_NAMES[level]}`}
  title={LEVEL_NAMES[level]}
>
  {LEVEL_ICONS[level]}
</div>
```

### 2.3 레벨업 애니메이션 — 반짝임 효과

레벨업 시 3단계 시퀀스:

```
t=0ms    배지 스케일 1 → 2.5 (bounce spring)
t=300ms  골드 후광 링 확산 (ring-expand keyframe, opacity 1→0)
t=600ms  배지 스케일 2.5 → 1 (settle)
t=800ms  "+레벨업! 🎉" 말풍선 강제 표시
```

CSS keyframe:

```css
@keyframes level-up-ring {
  0%   { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(3); opacity: 0; }
}

@keyframes level-up-badge {
  0%   { transform: translate(25%, 25%) scale(1); }
  40%  { transform: translate(25%, 25%) scale(2.5) rotate(15deg); }
  70%  { transform: translate(25%, 25%) scale(2.2) rotate(-5deg); }
  100% { transform: translate(25%, 25%) scale(1) rotate(0deg); }
}
```

### 2.4 말풍선 내 레벨 표시 (선택 옵션)

말풍선 우상단 코너에 `Lv.2` 뱃지를 미니 사이즈로 표시:

```
┌────────────────────────┬──────┐
│ 야호! 찾았다! 🎉        │ Lv.2 │
└────────────────────────┴──────┘
              ▽ (말풍선 꼬리)
```

---

## 3. 계절 의상 시스템

### 3.1 의상 레이어 구조

기존 `KimchiSvg` SVG 위에 별도 `CostumeOverlay` SVG를 absolute 레이어로 적층:

```
[ KimchiSvg 60×60px ]  ← 기존 배추 몸통 (z-index 0)
[ CostumeOverlay ]     ← 의상 SVG 오버레이 (z-index 10, 동일 viewBox 0 0 60 60)
```

컨테이너 구조:

```tsx
<div className="relative w-[60px] h-[60px]">
  <KimchiSvg state={state} size={60} />
  {costume && (
    <CostumeOverlay
      type={costume}
      className="absolute inset-0 pointer-events-none"
    />
  )}
  <LevelBadge level={level} />
</div>
```

### 3.2 의상 종류 및 활성 조건

| ID | 이름 | 활성 조건 | 우선순위 |
|----|------|-----------|---------|
| `kimjang` | 김장철 두건 | 11월, 12월 | 2 |
| `seollal` | 설날 갓 | 1월 1~15일 | 1 |
| `chuseok` | 추석 갓끈 | 음력 8월 15일 ±3일 | 1 |
| `summer`  | 여름 선글라스 | 7~8월 | 3 |
| `none`    | 기본 (의상 없음) | 그 외 | — |

### 3.3 김장철 두건 의상 — ASCII 모크업

```
SVG viewBox 0 0 60 60 기준:

       ←  두건 천 조각 (상단 와이드) →
      ╭───────────────────────────╮
     /  두건 묶음 끈 (노랑 #FFD166)  \
    /   ~~~~~~~~~~~~~~~~~~~~~~~~~~~   \
   |   (배추 잎사귀는 두건 아래 살짝   |
   |    보임 — 잎사귀 y좌표 조정 불필) |

실제 SVG 요소:
  - <path d="M 10 18 Q 30 8 50 18 L 52 24 Q 30 16 8 24 Z"
           fill="#8B4513" opacity="0.85" />  ← 두건 천 (갈색)
  - <rect x="26" y="22" width="8" height="4" rx="2"
          fill="#FFD166" />                  ← 이마 끈
  - <path d="M 5 22 Q 8 19 12 21" stroke="#6B3410"
          strokeWidth="2" fill="none" />     ← 좌측 묶음
  - <path d="M 55 22 Q 52 19 48 21" stroke="#6B3410"
          strokeWidth="2" fill="none" />     ← 우측 묶음
```

전체 ASCII 시각화:

```
         ___________
        /  ==두건==  \
       /  갈색 천감   \
      /~~~이마끈~노랑~~\
     |                  |
     |  눈   [배추몸통]  |
     |  입               |
     |   팔           팔  |
```

### 3.4 설날 갓 의상 — ASCII 모크업

```
SVG viewBox 0 0 60 60 기준:

           ●  (갓 꼭지, 2px 원)
          /|\
         / | \     ← 갓 상단 원뿔 (검정 #1a1a1a)
        /__|__\
       /         \
      /___________\  ← 갓 챙 (넓은 타원, 검정)
     |             |
     |   [캐릭터]   |
```

실제 SVG 요소:

```xml
<!-- 갓 챙 (넓은 타원) -->
<ellipse cx="30" cy="13" rx="20" ry="3.5"
         fill="#1a1a1a" opacity="0.9" />

<!-- 갓 본체 (위로 좁아지는 사다리꼴) -->
<path d="M 18 13 L 22 4 L 38 4 L 42 13 Z"
      fill="#1a1a1a" opacity="0.9" />

<!-- 갓 꼭지 -->
<circle cx="30" cy="3.5" r="1.5" fill="#1a1a1a" />

<!-- 갓끈 (턱 아래로 내려오는 선) — 빨간 매듭 -->
<line x1="20" y1="13" x2="16" y2="24"
      stroke="#E63946" strokeWidth="1.2" strokeLinecap="round" />
<line x1="40" y1="13" x2="44" y2="24"
      stroke="#E63946" strokeWidth="1.2" strokeLinecap="round" />
```

전체 ASCII 시각화:

```
              ●
             /|\
            / | \
           /  |  \
     _____/   |   \_____
    (    갓 챙 넓은 타원   )
    |                    |
    |  [김치군 얼굴+몸통]  |
    |                    |
```

### 3.5 의상 전환 애니메이션

```
활성화: opacity 0 → 1 (300ms ease-in)
비활성: opacity 1 → 0 (200ms ease-out)
특수 — 설날 갓: 위에서 떨어지는 효과
  translateY(-20px) opacity 0 → translateY(0) opacity 1 (400ms spring)
```

---

## 4. 인터랙션 UI

### 4.1 클릭 리플 효과

캐릭터 클릭 시 클릭 지점 중심으로 원형 물결 확산:

```
클릭 순간:

    ·  ·  ·
  ·   [김]   ·
    ·  치  ·    ← 리플 링 1 (r: 0→40px, opacity: 0.4→0, 400ms)
  ·   군  ·     ← 리플 링 2 (r: 0→60px, opacity: 0.2→0, 600ms, delay 100ms)
    ·  ·  ·
```

구현 방식 — CSS + React state:

```tsx
// 클릭 핸들러에서 리플 상태 추가
const [ripples, setRipples] = useState<{id:number; x:number; y:number}[]>([]);

const handleClick = (e: React.MouseEvent) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const id = Date.now();
  setRipples(prev => [...prev, {id, x, y}]);
  setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700);
  // 랜덤 대사 트리거
  dispatchMascotEvent({ state: 'idle' });
};
```

CSS:

```css
@keyframes ripple-expand {
  0%   { width: 0; height: 0; opacity: 0.5; }
  100% { width: 80px; height: 80px; opacity: 0; }
}

.mascot-ripple {
  position: absolute;
  border-radius: 50%;
  background: rgba(82, 183, 136, 0.4);
  animation: ripple-expand 600ms ease-out forwards;
  transform: translate(-50%, -50%);
  pointer-events: none;
}
```

### 4.2 말풍선 "새 대사" 버튼

말풍선 우상단에 새로고침 아이콘 버튼을 배치:

```
┌───────────────────────────┐
│ 야호! 찾았다! 🎉        [↺] │  ← ↺ = 새 대사 버튼 (16px, 클릭 시 같은 state 재트리거)
└───────────────────────────┘
              ▽
```

버튼 spec:
- 크기: 16×16px, 아이콘: Lucide `RefreshCw`
- 색상: `text-brand-text-secondary hover:text-brand-text-primary`
- 클릭: `getRandomPhrase(currentState)` 재호출 → `setPhrase(newPhrase)`
- 접근성: `aria-label="새 대사 보기"`, `title="새 대사"`

```
┌─────────────────────────────────┐
│                             [×] │  ← 기존 닫기 (dismissSpeech)
│ 야호! 찾았다! 🎉                 │
│                             [↺] │  ← 신규 새 대사 버튼
└─────────────────────────────────┘
```

레이아웃:

```tsx
<div className="flex items-start gap-1">
  <p className="flex-1 break-keep text-sm">{text}{emoji}</p>
  <div className="flex flex-col gap-0.5 ml-1 shrink-0">
    <button onClick={onDismiss} aria-label="닫기" className="...">
      <X size={12} />
    </button>
    <button onClick={onRefresh} aria-label="새 대사 보기" className="...">
      <RefreshCw size={12} />
    </button>
  </div>
</div>
```

### 4.3 호버 시 눈 반짝임 (Sparkle)

캐릭터 위에 마우스를 올리면 눈에 별빛 반짝임 효과:

```
호버 전:     호버 후:
  ●  ●        ✦  ✦   ← 눈이 반짝이는 별 모양으로 교체
              (CSS 필터: drop-shadow + 스케일 1→1.3)
```

구현:

```css
/* KimchiSvg 부모 div에 group 클래스 추가 */
.kimchi-mascot__eye-sparkle {
  opacity: 0;
  transition: opacity 200ms ease;
}

.group:hover .kimchi-mascot__eye-sparkle {
  opacity: 1;
}

@keyframes sparkle-blink {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
  50%       { transform: scale(1.3) rotate(20deg); opacity: 0.7; }
}
```

SVG에 추가될 호버 전용 요소 (sleeping/error 상태 제외):

```xml
<!-- 호버 반짝임 오버레이 (group:hover 시 표시) -->
<g class="kimchi-mascot__eye-sparkle">
  <!-- 왼쪽 눈 별빛 -->
  <path d="M 24 27 L 24.5 25.5 L 25 27 L 26.5 27.5 L 25 28 L 24.5 29.5 L 24 28 L 22.5 27.5 Z"
        fill="#FFD166" style="animation: sparkle-blink 1s ease infinite;" />
  <!-- 오른쪽 눈 별빛 -->
  <path d="M 36 27 L 36.5 25.5 L 37 27 L 38.5 27.5 L 37 28 L 36.5 29.5 L 36 28 L 34.5 27.5 Z"
        fill="#FFD166" style="animation: sparkle-blink 1s ease infinite 0.3s;" />
</g>
```

---

## 5. 성취 배지 팝업

### 5.1 토스트 vs 모달 비교

| 항목 | 토스트 스타일 | 모달 스타일 |
|------|-------------|------------|
| 위치 | 화면 상단 중앙, 고정 | 화면 정중앙, 오버레이 |
| 크기 | 320×80px | 480×320px |
| 지속 | 4초 자동 해제 | 사용자 확인(닫기) 필수 |
| 방해도 | 낮음 (작업 지속 가능) | 높음 (블로킹) |
| 적합 | 마일스톤 진입 시 | 최고 레벨 달성, 희귀 배지 |
| 추천 | **기본값** (Lv1→2, Lv2→3) | 특별 (Lv3→4, 첫 업로드) |

### 5.2 토스트 스타일 — ASCII 모크업

```
화면 상단 (top: 20px, 중앙 정렬):

┌────────────────────────────────────────┐
│  🏅  성취 달성!                   [×]  │
│                                         │
│  배추君 레벨 달성 🥬                    │
│  채팅 10회를 완료했습니다!              │
└────────────────────────────────────────┘
                ↕ 320×80px 토스트
```

진입 애니메이션:

```css
@keyframes toast-slide-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0);     opacity: 1; }
}

@keyframes toast-slide-up {
  from { transform: translateY(0);     opacity: 1; }
  to   { transform: translateY(-100%); opacity: 0; }
}
```

색상: 배경 `#1a1a2e` (진한 남색), 테두리 `#FFD166` (골드), 배지 아이콘 64px

### 5.3 모달 스타일 — ASCII 모크업

```
화면 전체에 반투명 오버레이 (rgba(0,0,0,0.5)):

        ┌──────────────────────────┐
        │                          │
        │       🎊  🎉  🎊         │  ← 파티클 파열 (JS confetti)
        │                          │
        │   ╔════════════════╗     │
        │   ║  숙성김치君 🔴  ║     │
        │   ║  Level 4 달성!  ║     │
        │   ║                 ║     │
        │   ║  "200번의 대화  ║     │
        │   ║   끝에 여기까지 ║     │
        │   ║   왔어요! 🥳"   ║     │
        │   ║                 ║     │
        │   ║  [  확인  ]     ║     │
        │   ╚════════════════╝     │
        │                          │
        └──────────────────────────┘
```

배지 아이콘: 128px 크기 레벨 아이콘 + 골드 글로우 `box-shadow: 0 0 30px rgba(255,209,102,0.8)`

```tsx
// 모달 컴포넌트 구조
<div role="dialog" aria-modal="true" aria-labelledby="achievement-title">
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]"
       onClick={onClose}>
    <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
         onClick={e => e.stopPropagation()}>
      <div className="text-[128px] mb-4" role="img" aria-label={achievementName}>
        {achievementIcon}
      </div>
      <h2 id="achievement-title" className="text-2xl font-bold mb-2">
        {achievementName}
      </h2>
      <p className="text-brand-text-secondary mb-6">{achievementDesc}</p>
      <button onClick={onClose} className="btn-primary w-full">확인</button>
    </div>
  </div>
</div>
```

### 5.4 마일스톤 배지 목록

| ID | 이름 | 조건 | 팝업 타입 | 아이콘 |
|----|------|------|-----------|--------|
| `first_chat` | 첫 대화 | 첫 채팅 전송 | toast | 💬 |
| `first_upload` | 첫 문서 | 첫 파일 업로드 | modal | 📄 |
| `level_2` | 배추 졸업 | 레벨 1→2 | toast | 🥬 |
| `level_3` | 파김치 입문 | 레벨 2→3 | toast | 🌿 |
| `level_4` | 숙성 완료 | 레벨 3→4 | **modal** | 🔴 |
| `night_owl` | 야간 부엉이 | 22시 이후 5회 | toast | 🦉 |
| `power_user` | 파워 유저 | 하루 30회 채팅 | toast | ⚡ |

---

## 6. 야간 모드 강화 UI

### 6.1 졸음 Z파티클 애니메이션

현재 sleeping 상태에서 SVG 내 정적 Zzz 텍스트 → 동적 파티클로 업그레이드:

```
현재 (정적):           신규 (동적 파티클):

[김치군 sleeping]       [김치군 sleeping]
   Z                       Z  ← Z3 (크기 6px, opacity 0.7, 회전 5°)
  z                       z   ← Z2 (크기 5px, opacity 0.5, 회전 -3°)
 z                      z    ← Z1 (크기 4px, opacity 0.3, 회전 8°)
                              ↑ 각각 위로 떠올라 사라지는 keyframe
```

CSS keyframe:

```css
@keyframes zzz-float {
  0%   {
    transform: translate(0, 0) rotate(0deg) scale(1);
    opacity: 0.7;
  }
  100% {
    transform: translate(8px, -20px) rotate(15deg) scale(0.5);
    opacity: 0;
  }
}

.kimchi-mascot__zzz-particle {
  animation: zzz-float var(--duration, 2s) ease-out infinite;
}

.kimchi-mascot__zzz-particle:nth-child(1) { animation-delay: 0s;    --duration: 2s;   }
.kimchi-mascot__zzz-particle:nth-child(2) { animation-delay: 0.6s;  --duration: 2.2s; }
.kimchi-mascot__zzz-particle:nth-child(3) { animation-delay: 1.2s;  --duration: 2.4s; }
```

SVG 수정안:

```xml
<!-- sleeping 상태: 동적 Zzz (기존 정적 텍스트 교체) -->
{state === 'sleeping' && (
  <g>
    <text x="44" y="20" fontSize="7" fill="#A8907A" fontWeight="bold"
          className="kimchi-mascot__zzz-particle" style={{animationDelay:'0s'}}>Z</text>
    <text x="47" y="14" fontSize="5.5" fill="#A8907A" fontWeight="bold"
          className="kimchi-mascot__zzz-particle" style={{animationDelay:'0.6s'}}>z</text>
    <text x="50" y="9" fontSize="4.5" fill="#A8907A" fontWeight="bold"
          className="kimchi-mascot__zzz-particle" style={{animationDelay:'1.2s'}}>z</text>
  </g>
)}
```

### 6.2 화면 어둠 처리 연동

**옵션 A — 마스코트 주변 달빛 글로우**:
sleeping 상태 진입 시 캐릭터 주변에 부드러운 달빛색 후광을 추가:

```
              🌙
         (달 아이콘 24px)
    ·  ·  ·  ·  ·  ·  ·
  ·   부드러운 달빛 글로우   ·
    ·   [김치군 sleeping]  ·
  ·  ·  ·  ·  ·  ·  ·  ·
```

CSS:

```css
.kimchi-mascot--sleeping-container {
  filter: drop-shadow(0 0 12px rgba(180, 200, 255, 0.4));
  transition: filter 1s ease;
}
```

**옵션 B — 화면 주변부 비네팅 (선택적)**:
sleeping 상태 전환 시 화면 가장자리를 부드럽게 어둡게 처리. 단, 사용자 작업을 방해하므로 `settings.nightVignette` 설정으로 ON/OFF 분리.

```
┌──────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← 가장자리 그라데이션 어둠
│ ░░                              ░░░ │     (pointer-events: none, z-index: 49)
│ ░░    [메인 콘텐츠 영역]          ░░ │
│ ░░                              ░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────┘
```

CSS:

```css
.night-vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 49;
  background: radial-gradient(
    ellipse at center,
    transparent 50%,
    rgba(0, 0, 20, 0.3) 100%
  );
  animation: vignette-fade-in 2s ease;
}
```

### 6.3 달 아이콘 부유 효과

sleeping 상태에서 캐릭터 우상단에 달 아이콘이 천천히 떠다니는 효과:

```
         🌙  ← 달 (20px, 위아래 7px 진동, 8초 주기)
        /
[김치군]
```

```css
@keyframes moon-float {
  0%, 100% { transform: translateY(0px) rotate(-5deg); }
  50%       { transform: translateY(-7px) rotate(5deg); }
}

.mascot-moon {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 20px;
  animation: moon-float 8s ease-in-out infinite;
  pointer-events: none;
}
```

---

## 7. 컴포넌트 변경 영향도 분석

### 7.1 신규 파일

| 파일 | 역할 | 우선순위 |
|------|------|---------|
| `components/mascot/LevelBadge.tsx` | 레벨 배지 컴포넌트 | P1 |
| `components/mascot/CostumeOverlay.tsx` | 계절 의상 SVG 오버레이 | P2 |
| `components/mascot/AchievementToast.tsx` | 성취 토스트 알림 | P1 |
| `components/mascot/AchievementModal.tsx` | 성취 모달 (대형) | P2 |
| `hooks/useMascotLevel.ts` | 레벨/카운트/배지 상태 관리 | P1 |
| `hooks/useMascotCostume.ts` | 계절 의상 결정 로직 | P2 |
| `lib/utils/achievement.ts` | 마일스톤 정의 + 달성 체크 | P1 |

### 7.2 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `components/mascot/KimchiMascotContainer.tsx` | LevelBadge, CostumeOverlay 추가; 클릭 핸들러; 리플 렌더 |
| `components/mascot/KimchiSvg.tsx` | 호버 sparkle 요소 추가; Zzz 동적 파티클로 교체 |
| `components/mascot/MascotSpeech.tsx` | 새 대사 버튼(↺) 추가; Lv 뱃지 옵션 |
| `hooks/useMascot.ts` | 클릭 카운터 연동; achievement 트리거 |
| `types/mascot.ts` | `MascotLevel`, `MascotCostume`, `Achievement` 타입 추가 |
| `app/globals.css` | 신규 keyframe 추가 (level-up-ring, ripple-expand, zzz-float, moon-float) |

### 7.3 LocalStorage 키 목록

| 키 | 값 타입 | 용도 |
|----|---------|------|
| `kimchi-mascot-settings` | `MascotSettings` JSON | 기존 (enabled/speechEnabled) |
| `kimchi-level-count` | `number` | 상호작용 누적 카운트 |
| `kimchi-achievements` | `string[]` (badge IDs) | 달성한 배지 목록 |
| `kimchi-costume-override` | `string \| null` | 수동 의상 선택 (설정에서) |

---

## 8. 접근성 설계

| 요소 | 접근성 처리 |
|------|------------|
| 레벨 배지 | `aria-label="레벨 2: 배추君"`, `title` 툴팁 |
| 리플 효과 | `aria-hidden="true"` (장식 전용) |
| 새 대사 버튼 | `aria-label="새 대사 보기"`, `role="button"` |
| 호버 반짝임 | `prefers-reduced-motion` 시 비활성 |
| 성취 토스트 | `role="status"`, `aria-live="polite"` |
| 성취 모달 | `role="dialog"`, `aria-modal="true"`, focus trap |
| Zzz 파티클 | `prefers-reduced-motion` 시 정적 유지 |
| 달 아이콘 | `aria-hidden="true"` |
| 야간 비네팅 | `pointer-events: none`, `aria-hidden="true"` |

---

## 9. 성능 고려사항

- **CSS-only 애니메이션** 우선 (GPU 가속 transform/opacity만 사용)
- `will-change: transform` — 비행 컨테이너, 레벨업 배지에만 선택 적용
- Zzz 파티클: 3개 텍스트 노드만 — DOM 부하 최소
- 리플: 1개 원형 div, 700ms 후 즉시 DOM 제거
- 달 아이콘: `animation-play-state: paused` — sleeping 상태 아닐 때 정지
- 의상 오버레이: 동일 viewBox SVG, 추가 HTTP 요청 없음 (인라인 SVG)
- 레벨/배지 상태: LocalStorage 동기 읽기 최소화 — 마운트 시 1회 로드 후 메모리 관리

---

## 10. 구현 우선순위 로드맵

### Sprint A (P1 — 핵심 인터랙션)
1. 클릭 리플 효과 (`KimchiMascotContainer.tsx` + CSS)
2. 새 대사 버튼 (`MascotSpeech.tsx`)
3. 레벨 배지 시스템 (`LevelBadge.tsx` + `useMascotLevel.ts`)
4. 성취 토스트 (`AchievementToast.tsx`)

### Sprint B (P2 — 시각 강화)
5. 계절 의상 시스템 (`CostumeOverlay.tsx` + `useMascotCostume.ts`)
6. 호버 눈 반짝임 (`KimchiSvg.tsx` 수정)
7. Zzz 동적 파티클 (sleeping 상태 강화)
8. 달 아이콘 부유 효과

### Sprint C (P3 — 특별 이벤트)
9. 레벨업 모달 (최고 레벨 전용)
10. 야간 비네팅 (옵션 설정)

---

*작성: UI/UX Designer (kimchi-mascot-creative 팀)*
*검토 필요: Architecture (기술 아키텍처 문서와 교차 검토), Dev (구현 가능성 확인)*
