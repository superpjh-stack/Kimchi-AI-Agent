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
