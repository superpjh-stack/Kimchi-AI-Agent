# Design: Chunking Options — 문서 청킹 옵션 선택 기능

**Feature ID**: chunking-options
**Created**: 2026-02-27
**Parent Feature**: kimchi-agent
**Phase**: MVP Enhancement
**Status**: Design

---

## 1. 변경 범위 요약

```
변경 파일:
  types/index.ts                         # ChunkingMethod, ChunkingOptions 타입 추가
  lib/rag/chunker.ts                     # 5가지 청킹 전략 구현
  lib/rag/pipeline.ts                    # ingestDocument에 청킹 옵션 파라미터 추가
  app/api/documents/upload/route.ts      # chunkingMethod 파라미터 수신 처리
  components/documents/DocumentUpload.tsx # 청킹 옵션 선택 UI 추가

신규 파일:
  components/documents/ChunkingOptions.tsx # 청킹 옵션 선택 컴포넌트
```

---

## 2. 타입 설계

```typescript
// types/index.ts에 추가

/** 청킹 전략 식별자 */
export type ChunkingMethod =
  | 'recursive'     // RecursiveCharacterTextSplitter (기본)
  | 'fixed'         // 고정 크기 분할
  | 'paragraph'     // 문단 단위 분할
  | 'row'           // 행 단위 분할 (CSV/XLSX)
  | 'sentence';     // 문장 단위 분할

/** 청킹 옵션 파라미터 */
export interface ChunkingOptions {
  method: ChunkingMethod;
  chunkSize?: number;       // fixed, recursive에서 사용
  chunkOverlap?: number;    // fixed, recursive에서 사용
  rowsPerChunk?: number;    // row에서 사용
  maxChunkSize?: number;    // paragraph에서 사용
  sentencesPerChunk?: number; // sentence에서 사용
  sentenceOverlap?: number;   // sentence에서 사용
}

/** 청킹 전략 메타데이터 (UI 표시용) */
export interface ChunkingStrategyInfo {
  method: ChunkingMethod;
  name: string;           // 한국어 표시명
  description: string;    // 설명
  recommendedFor: string[]; // 추천 파일 확장자 목록
  defaults: Partial<ChunkingOptions>;
}
```

---

## 3. 청킹 전략 설계

### 3.1 전략 메타데이터 정의

```typescript
// lib/rag/chunker.ts에 추가

export const CHUNKING_STRATEGIES: ChunkingStrategyInfo[] = [
  {
    method: 'recursive',
    name: '재귀 분할 (기본)',
    description: '문단 → 줄 → 공백 순서로 재귀적 분할. 범용 문서에 최적.',
    recommendedFor: ['.txt', '.pdf'],
    defaults: { chunkSize: 1000, chunkOverlap: 200 },
  },
  {
    method: 'fixed',
    name: '고정 크기 분할',
    description: '지정된 글자 수로 균등 분할. 로그, 짧은 문서에 적합.',
    recommendedFor: [],
    defaults: { chunkSize: 1000, chunkOverlap: 100 },
  },
  {
    method: 'paragraph',
    name: '문단 단위 분할',
    description: '빈 줄(문단 경계) 기준 분할. 매뉴얼, 보고서에 적합.',
    recommendedFor: [],
    defaults: { maxChunkSize: 2000 },
  },
  {
    method: 'row',
    name: '행 단위 분할 (테이블)',
    description: '헤더를 보존하며 행 단위 분할. CSV/XLSX 데이터에 최적.',
    recommendedFor: ['.csv', '.xlsx'],
    defaults: { rowsPerChunk: 50 },
  },
  {
    method: 'sentence',
    name: '문장 단위 분할',
    description: '마침표/물음표 기준 문장 분할. FAQ, Q&A 문서에 적합.',
    recommendedFor: [],
    defaults: { sentencesPerChunk: 10, sentenceOverlap: 2 },
  },
];
```

### 3.2 각 전략 구현 로직

#### CS-01: Recursive (기존 유지)
- 기존 `splitTextRecursive()` + `mergeChunks()` 그대로 사용
- separators: `['\n\n', '\n', ' ', '']`

#### CS-02: Fixed Size
```
text → chunkSize 간격으로 잘라냄 → overlap만큼 이전 청크 끝부분 포함
```

#### CS-03: By Paragraph
```
text.split('\n\n') → 각 문단을 청크로 → maxChunkSize 초과 시 재분할
```

#### CS-04: By Row (CSV/Table)
```
lines = text.split('\n')
header = lines[0]
rows를 rowsPerChunk개씩 묶되 각 청크 앞에 header 삽입
```

#### CS-05: By Sentence
```
sentences = text.split(/[.!?。]\s/) → sentencesPerChunk개씩 묶음 → sentenceOverlap개 겹침
```

---

## 4. 컴포넌트 설계

### 4.1 ChunkingOptions 컴포넌트

```typescript
// components/documents/ChunkingOptions.tsx

interface ChunkingOptionsProps {
  fileExtension: string;              // 업로드 파일 확장자
  value: ChunkingOptions;             // 현재 선택된 옵션
  onChange: (options: ChunkingOptions) => void;
}
```

**UI 레이아웃:**
```
┌─────────────────────────────────────────────┐
│  청킹 방법 선택                               │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ ● 재귀 분할 (기본)         [추천]    │    │
│  │   범용 문서에 최적                    │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ○ 고정 크기 분할                     │    │
│  │   로그, 짧은 문서에 적합              │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ○ 문단 단위 분할                     │    │
│  │   매뉴얼, 보고서에 적합              │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ○ 행 단위 분할 (테이블)              │    │
│  │   CSV/XLSX 데이터에 최적             │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐    │
│  │ ○ 문장 단위 분할                     │    │
│  │   FAQ, Q&A 문서에 적합              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ▶ 고급 설정                                 │
│  ┌─────────────────────────────────────┐    │
│  │ 청크 크기: [1000] 자                 │    │
│  │ 오버랩:   [200]  자                  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│           [업로드]                            │
└─────────────────────────────────────────────┘
```

**동작:**
1. 파일 확장자에 따라 추천 전략 자동 하이라이트
2. 추천 전략에 `[추천]` 배지 표시 (kimchi-green 색상)
3. 전략 선택 시 해당 전략의 기본 파라미터로 고급 설정 자동 업데이트
4. 고급 설정은 기본적으로 접힘 (토글로 펼침)
5. 파라미터 변경 시 `onChange` 콜백으로 부모에 전달

### 4.2 DocumentUpload 수정

기존 `handleFile` 흐름에 청킹 옵션 선택 단계를 삽입:

```
기존:  file선택 → 즉시 업로드
변경:  file선택 → 청킹옵션 선택 → 업로드 버튼 클릭 → 업로드
```

**상태 변경:**
```
idle → fileSelected → uploading → success → idle
```

- `fileSelected`: 새로운 상태. 파일이 선택되었지만 아직 업로드 전
- 이 상태에서 ChunkingOptions 컴포넌트를 표시
- "업로드" 버튼 클릭 시 선택된 옵션과 함께 API 호출

---

## 5. API 변경 설계

### 5.1 POST /api/documents/upload 변경

```typescript
// FormData 필드 추가:
// - file: File (기존)
// - name: string (기존)
// - chunkingMethod: ChunkingMethod (신규, optional → default 'recursive')
// - chunkingOptions: JSON string of ChunkingOptions (신규, optional)

// 서버 처리 흐름 변경:
// 1. 파일 수신 및 유효성 검사 (기존)
// 2. 텍스트 추출 (기존)
// 3. chunkingMethod/chunkingOptions 파싱
// 4. 선택된 전략으로 청킹 (변경)
// 5. 임베딩 생성 (기존)
// 6. Vector DB 저장 (기존)
```

### 5.2 UploadResponse 변경

```typescript
// types/index.ts UploadResponse에 추가
export interface UploadResponse {
  id: string;
  name: string;
  type: string;
  chunks: number;
  chunkingMethod: ChunkingMethod;  // 신규: 사용된 청킹 전략
  status: 'processed';
  createdAt: string;
}
```

---

## 6. pipeline.ts 변경 설계

```typescript
// lib/rag/pipeline.ts

export async function ingestDocument(
  text: string,
  docId: string,
  docName: string,
  chunkingOptions?: ChunkingOptions  // 신규 파라미터
): Promise<number> {
  // chunkingOptions가 없으면 기존 기본값(recursive) 사용
  const options: ChunkingOptions = chunkingOptions ?? {
    method: 'recursive',
    chunkSize: 1000,
    chunkOverlap: 200,
  };

  const chunks = chunkText(text, docId, docName, options);
  // ... 이하 기존 로직 동일
}
```

---

## 7. chunker.ts 변경 설계

```typescript
// lib/rag/chunker.ts

// 기존 chunkText 시그니처 변경:
export function chunkText(
  text: string,
  docId: string,
  docName: string,
  options?: ChunkingOptions   // 기존 chunkSize/chunkOverlap 대체
): Chunk[] {
  const method = options?.method ?? 'recursive';

  switch (method) {
    case 'recursive':
      return chunkRecursive(text, docId, docName, options);
    case 'fixed':
      return chunkFixed(text, docId, docName, options);
    case 'paragraph':
      return chunkByParagraph(text, docId, docName, options);
    case 'row':
      return chunkByRow(text, docId, docName, options);
    case 'sentence':
      return chunkBySentence(text, docId, docName, options);
    default:
      return chunkRecursive(text, docId, docName, options);
  }
}
```

---

## 8. 데이터 흐름 (End-to-End)

```
[사용자]
    │
    │ 1. 파일 드래그/선택
    ▼
[DocumentUpload] ─── fileSelected 상태
    │
    │ 2. ChunkingOptions 표시 (확장자별 추천 자동 선택)
    │    사용자가 전략 선택 + 고급 설정 (선택적)
    ▼
[DocumentUpload] ─── "업로드" 버튼 클릭
    │
    │ 3. FormData: file + name + chunkingMethod + chunkingOptions
    ▼
[POST /api/documents/upload]
    │
    │ 4. extractText(file) → text
    │ 5. parse chunkingMethod & chunkingOptions
    ▼
[ingestDocument(text, docId, docName, chunkingOptions)]
    │
    │ 6. chunkText(text, docId, docName, options)
    │    → 선택된 전략으로 청킹
    │ 7. embedBatch(chunks)
    │ 8. addDocuments(chunks, vectors)
    ▼
[Response: { id, name, type, chunks, chunkingMethod, status }]
    │
    ▼
[DocumentUpload] ─── success 상태
    사용된 전략 + 청크 수 표시
```

---

## 9. 스타일 가이드

- 추천 배지: `bg-kimchi-green/10 text-kimchi-green border-kimchi-green` (rounded-full px-2 py-0.5 text-xs)
- 선택된 옵션: `border-kimchi-red bg-red-50`
- 미선택 옵션: `border-gray-200 hover:border-gray-300`
- 고급 설정 토글: `text-sm text-gray-500 cursor-pointer` + ChevronDown/Up 아이콘
- 숫자 입력: `w-20 text-center border rounded px-2 py-1`

---

## 10. 하위 호환성

1. `chunkText()` 함수: `options` 파라미터 optional → 없으면 기존 `recursive` 기본값
2. `ingestDocument()`: `chunkingOptions` 파라미터 optional → 없으면 기존 동작
3. Upload API: `chunkingMethod` FormData 필드 optional → 없으면 `recursive`
4. `UploadResponse`에 `chunkingMethod` 추가 → 기존 클라이언트는 무시

---

*Design document created by CTO Team — 2026-02-27*
