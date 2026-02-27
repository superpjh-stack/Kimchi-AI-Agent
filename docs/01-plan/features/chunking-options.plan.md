# Plan: Chunking Options — 문서 청킹 옵션 선택 기능

**Feature ID**: chunking-options
**Created**: 2026-02-27
**Parent Feature**: kimchi-agent
**Level**: Dynamic
**Priority**: Medium
**Status**: Planning

---

## 1. Overview (개요)

문서 업로드 시 관리자가 데이터 타입에 따라 최적의 청킹(Chunking) 방법을 선택할 수 있는 기능.
기존 `RecursiveCharacterTextSplitter` (1000자/200 overlap)를 기본값으로 유지하면서, 추가 청킹 전략을 제공하여 RAG 검색 품질을 향상시킨다.

---

## 2. Problem Statement (문제 정의)

- 현재 단일 청킹 전략(RecursiveCharacterTextSplitter)만 사용하여 모든 문서를 동일하게 처리
- 문서 유형(매뉴얼, CSV 데이터, 레시피, 품질 보고서)마다 최적의 청킹 전략이 다름
- 관리자가 문서 특성에 맞게 청킹 방법을 조정할 수 없음
- 부적절한 청킹은 RAG 검색 품질 저하로 이어짐

---

## 3. Goals (목표)

- [ ] 문서 업로드 UI에 청킹 옵션 선택 UI 추가
- [ ] 최소 4가지 청킹 전략 제공
- [ ] 각 옵션에 추천(Recommended) 라벨 표시로 가이드 제공
- [ ] 파일 확장자에 따라 기본 추천 전략 자동 선택
- [ ] 기존 기본값(Recursive 1000자/200 overlap) 유지

---

## 4. User Stories (사용자 스토리)

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-CO-01 | 관리자 | 문서 업로드 시 청킹 방법을 선택하고 싶다 | 데이터 타입에 맞는 최적 처리를 할 수 있다 |
| US-CO-02 | 관리자 | 어떤 청킹 방법이 추천인지 확인하고 싶다 | 최적의 옵션을 빠르게 선택할 수 있다 |
| US-CO-03 | 관리자 | CSV/XLSX 파일에는 행 단위 청킹을 선택하고 싶다 | 테이블 데이터가 깨지지 않고 보존된다 |
| US-CO-04 | 관리자 | 긴 매뉴얼 문서에는 큰 청크 사이즈를 사용하고 싶다 | 문맥이 충분히 유지된 청크를 생성한다 |
| US-CO-05 | 운영자 | 기본 설정으로 빠르게 업로드하고 싶다 | 청킹에 대해 몰라도 괜찮다 |

---

## 5. Functional Requirements (기능 요구사항)

### 5.1 청킹 전략 목록

| ID | 전략명 | 설명 | 파라미터 | 추천 대상 |
|----|--------|------|----------|-----------|
| CS-01 | Recursive (기본) | RecursiveCharacterTextSplitter | chunkSize: 1000, overlap: 200 | TXT, PDF (일반 문서) |
| CS-02 | Fixed Size | 고정 크기 분할 | chunkSize: 500/1000/2000, overlap: 0~200 | 짧은 문서, 로그 |
| CS-03 | By Paragraph | 문단(빈줄) 단위 분할 | maxChunkSize: 2000 | 매뉴얼, 보고서 |
| CS-04 | By Row (CSV/Table) | 행 단위 분할 (헤더 보존) | rowsPerChunk: 50 | CSV, XLSX |
| CS-05 | By Sentence | 문장 단위 분할 | sentencesPerChunk: 10, overlap: 2 | FAQ, Q&A 문서 |

### 5.2 UI 요구사항

- FR-CO-01: 파일 선택 후, 업로드 전에 청킹 옵션 선택 UI 표시
- FR-CO-02: 각 옵션에 이름, 설명, "추천" 배지 표시
- FR-CO-03: 파일 확장자에 따라 추천 옵션 자동 표시 (예: CSV → By Row 추천)
- FR-CO-04: 기본 선택은 Recursive (기존 동작 유지)
- FR-CO-05: 고급 설정 토글로 chunkSize, overlap 등 세부 파라미터 조정 가능
- FR-CO-06: 선택 즉시 예상 청크 수 미리보기 (선택적, Phase 2)

### 5.3 API 요구사항

- FR-CO-07: `/api/documents/upload` POST에 `chunkingMethod` 필드 추가
- FR-CO-08: `chunkingOptions` 객체로 세부 파라미터 전달
- FR-CO-09: `chunkingMethod` 미지정 시 기존 Recursive 기본값 사용 (하위 호환)

### 5.4 Backend 요구사항

- FR-CO-10: `lib/rag/chunker.ts`에 새로운 청킹 전략 함수 추가
- FR-CO-11: `pipeline.ts`의 `ingestDocument()`에 청킹 방법 파라미터 전달
- FR-CO-12: 각 전략별 적절한 기본 파라미터 설정

---

## 6. Non-Functional Requirements (비기능 요구사항)

- NFR-CO-01: 기존 업로드 기능 하위 호환 (chunkingMethod 없이도 동작)
- NFR-CO-02: 청킹 옵션 UI는 모바일에서도 사용 가능
- NFR-CO-03: 새 전략 추가 시 최소 코드 변경으로 확장 가능한 구조

---

## 7. File Extension → Recommended Strategy Mapping

| 파일 확장자 | 기본 추천 전략 | 이유 |
|-------------|---------------|------|
| .txt | Recursive | 범용 텍스트에 최적 |
| .pdf | Recursive | 문단 구조가 다양 |
| .csv | By Row | 테이블 행 단위 보존 |
| .xlsx | By Row | 시트/행 구조 보존 |

---

## 8. Implementation Scope

### In Scope (이번 구현)
- 5가지 청킹 전략 구현
- DocumentUpload 컴포넌트에 옵션 선택 UI 추가
- Upload API에 chunkingMethod 파라미터 추가
- chunker.ts에 새 전략 함수 추가
- pipeline.ts 수정

### Out of Scope (향후)
- 청크 미리보기 (업로드 전 예상 청크 수)
- 사용자 커스텀 청킹 전략 정의
- 청킹 결과 비교 기능

---

## 9. Success Metrics (성공 지표)

- 5가지 청킹 전략 모두 정상 동작
- 파일 확장자별 추천 전략 자동 선택
- 기존 업로드 기능 하위 호환 100%
- 관리자가 3클릭 이내로 청킹 옵션 선택 및 업로드 가능

---

*Plan created by CTO Team — 2026-02-27*

---

## 10. Enhancement: 상세 선택 UI

**요청 배경**: 사용자(공장 관리자)가 "5개 청킹 방법에 대해 더 상세한 선택을 하면 좋겠다"고 요청.
**추가일**: 2026-02-27
**우선순위**: Medium
**대상 파일**: `components/documents/ChunkingOptions.tsx`

---

### 10.1 개선 요구사항 분석

#### 10.1.1 예상 청크 수 실시간 계산

- 파일 크기(바이트 또는 문자 수) 기반 근사치 계산
- 각 전략별 계산 공식:
  - **recursive / fixed**: `Math.ceil(fileChars / (chunkSize - chunkOverlap))`
  - **paragraph**: `Math.ceil(fileChars / maxChunkSize)` (실제 문단 수 알 수 없으므로 근사)
  - **row**: `Math.ceil(estimatedRows / rowsPerChunk)` (파일 바이트 기반 행 수 추정)
  - **sentence**: `Math.ceil(estimatedSentences / (sentencesPerChunk - sentenceOverlap))` (문자당 평균 문장 길이 추정)
- UI 표시: 선택된 전략 카드 하단 또는 고급 설정 상단에 "예상 청크 수: ~N개" 뱃지로 표시
- 파라미터 변경 시 실시간 업데이트 (debounce 불필요, 단순 계산)
- `props`에 `fileSizeBytes?: number` 또는 `fileCharCount?: number` 추가

#### 10.1.2 파라미터 슬라이더 컨트롤

- 현재 숫자 입력 필드(`<input type="number">`)를 **슬라이더 + 숫자 병행** 방식으로 교체
- 각 파라미터별 슬라이더 범위:

| 파라미터 | min | max | step | 전략 |
|---------|-----|-----|------|------|
| chunkSize | 200 | 5000 | 100 | recursive, fixed |
| chunkOverlap | 0 | 1000 | 50 | recursive, fixed |
| maxChunkSize | 500 | 10000 | 500 | paragraph |
| rowsPerChunk | 10 | 200 | 10 | row |
| sentencesPerChunk | 2 | 50 | 1 | sentence |
| sentenceOverlap | 0 | 10 | 1 | sentence |

- 슬라이더와 숫자 입력 쌍방향 동기화 (슬라이더 변경 → 숫자 업데이트, 숫자 직접 입력 → 슬라이더 이동)
- `chunkOverlap`은 `chunkSize`의 50% 이하 제약 표시 (시각적 경고, 차단은 하지 않음)

#### 10.1.3 각 전략의 동작 방식 시각적 표현

- 전략 카드 선택 시 확장 영역에 ASCII 다이어그램 또는 아이콘 기반 표현 표시
- 전략별 표현:

| 전략 | 시각적 표현 |
|------|------------|
| recursive | `[=====|==][==|=====][=====]` — 가변 크기, 오버랩 경계 표시 |
| fixed | `[=====][=====][=====]` — 균등한 블록 |
| paragraph | `[=문단1=][==문단2==][=문단3=]` — 불규칙 크기 블록 |
| row | `[HDR\|R1~50][HDR\|R51~100]` — 헤더 보존 행 묶음 |
| sentence | `[S1 S2...S10][S9 S10...S19]` — 문장 오버랩 표시 |

- 구현: 단순 `<pre>` 또는 인라인 div로 색상 블록 표현 (SVG 불필요)
- 카드 선택 시에만 표시 (항상 보이지 않도록)

#### 10.1.4 파라미터 변경 시 실시간 미리보기 업데이트

- 슬라이더/숫자 입력 변경 이벤트(`onChange`)마다 예상 청크 수 즉시 재계산
- `onChange` prop 호출 전에 로컬 state로 계산 후 UI 반영 (불필요한 상위 리렌더 방지)
- 예상 청크 수 외에 "평균 청크 크기" 근사치도 추가 표시 (`fileSizeBytes / expectedChunks`)

#### 10.1.5 전략별 장단점 요약 텍스트 표시

- 각 전략 카드에 펼쳐지는 장단점 섹션 추가 (선택된 카드에만 표시)
- 내용:

| 전략 | 장점 | 단점 |
|------|------|------|
| recursive | 문맥 보존 우수, 범용성 높음 | 처리 시간 다소 길 수 있음 |
| fixed | 처리 속도 빠름, 예측 가능한 청크 수 | 문장/단어 중간 분할 가능 |
| paragraph | 의미 단위 보존, 자연스러운 분할 | 문단 길이가 불균등할 경우 성능 차이 |
| row | 테이블 헤더 보존, 데이터 정합성 유지 | 비테이블 문서에는 부적합 |
| sentence | FAQ/Q&A 구조에 최적, 질의응답 품질 향상 | 문장 경계가 불명확한 문서에는 불리 |

---

### 10.2 UI 변경 사항 요약

**현재 구조** (`ChunkingOptions.tsx`):
```
[라디오 카드 목록]
  - 이름 + 추천 배지
  - 설명 텍스트 (1줄)
[고급 설정 토글]
  - 숫자 입력 필드
```

**개선 목표 구조**:
```
[라디오 카드 목록]
  - 이름 + 추천 배지 + 예상 청크 수 뱃지 (선택 시)
  - 설명 텍스트 (1줄)
  - [선택된 카드만] 동작 시각화 다이어그램
  - [선택된 카드만] 장점 / 단점 2열 요약
[파라미터 설정 (항상 표시, 고급 토글 제거)]
  - 슬라이더 + 숫자 입력 병행
  - 파라미터 변경 시 예상 청크 수 실시간 업데이트
```

---

### 10.3 Props 변경

```typescript
interface ChunkingOptionsProps {
  fileExtension: string;
  value: ChunkingOptionsType;
  onChange: (options: ChunkingOptionsType) => void;
  fileCharCount?: number;  // 추가: 예상 청크 수 계산용 (없으면 계산 생략)
}
```

---

### 10.4 구현 우선순위

| 항목 | 우선순위 | 난이도 | 비고 |
|------|---------|--------|------|
| 장단점 요약 텍스트 | High | Low | 정적 데이터, 즉시 구현 가능 |
| 슬라이더 컨트롤 | High | Low | HTML range input, 추가 패키지 불필요 |
| 예상 청크 수 계산 | Medium | Low | 단순 산술 계산 |
| 동작 시각화 다이어그램 | Medium | Medium | ASCII/div 블록, CSS 필요 |
| 실시간 미리보기 업데이트 | Low | Low | 계산 구현 후 자동 연동 |

---

### 10.5 수용 기준 (Acceptance Criteria)

- AC-ENH-01: 선택된 전략 카드에 장단점 텍스트가 표시된다
- AC-ENH-02: 파라미터 입력 시 슬라이더와 숫자 필드가 동기화된다
- AC-ENH-03: `fileCharCount` prop이 있을 때 예상 청크 수가 표시된다
- AC-ENH-04: 파라미터 변경 시 예상 청크 수가 즉시 업데이트된다
- AC-ENH-05: 선택된 전략의 동작 방식 다이어그램이 표시된다
- AC-ENH-06: 기존 `onChange` 동작과 하위 호환이 유지된다
- AC-ENH-07: 모바일 화면(375px 이상)에서도 슬라이더가 정상 동작한다
