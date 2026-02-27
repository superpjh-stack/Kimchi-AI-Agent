// F2: BM25 키워드 검색 인덱스 (외부 패키지 없는 순수 TS 구현)
// 한국어 + 영어 지원 — 공백/구두점 기반 토크나이저

// BM25 파라미터 (Robertson et al. 1994 권장값)
const K1 = 1.5;  // 단어 빈도 포화 파라미터
const B  = 0.75; // 문서 길이 정규화 파라미터

/**
 * 텍스트를 토큰 배열로 변환.
 * 한글 2자 이상 + 영문 2자 이상 + 숫자 포함
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

export interface BM25Result {
  key: string;
  score: number;
}

class BM25Index {
  /** key(docId::chunkIdx) → 토큰 배열 */
  private docs = new Map<string, string[]>();
  /** term → 해당 term을 포함하는 문서 수 */
  private df = new Map<string, number>();

  /** 청크를 인덱스에 추가 */
  add(key: string, text: string): void {
    if (this.docs.has(key)) this.removeKey(key); // 이미 있으면 교체
    const tokens = tokenize(text);
    this.docs.set(key, tokens);
    for (const term of new Set(tokens)) {
      this.df.set(term, (this.df.get(term) ?? 0) + 1);
    }
  }

  /** 특정 문서의 모든 청크 제거 (prefix 매칭) */
  remove(docIdPrefix: string): void {
    for (const key of [...this.docs.keys()]) {
      if (key.startsWith(`${docIdPrefix}::`)) {
        this.removeKey(key);
      }
    }
  }

  /** BM25 점수로 정렬된 상위 topK 결과 반환 */
  search(query: string, topK = 10): BM25Result[] {
    const N = this.docs.size;
    if (N === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // 평균 문서 길이
    let totalLen = 0;
    for (const tokens of this.docs.values()) totalLen += tokens.length;
    const avgdl = totalLen / N;

    const scores = new Map<string, number>();

    for (const [key, docTokens] of this.docs.entries()) {
      const dl = docTokens.length;

      // TF 계산
      const tf = new Map<string, number>();
      for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);

      let score = 0;
      for (const term of queryTokens) {
        const termTf = tf.get(term) ?? 0;
        if (termTf === 0) continue;

        const df = this.df.get(term) ?? 0;
        // IDF with Laplace smoothing
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        // BM25 TF normalization
        const norm = (termTf * (K1 + 1)) / (termTf + K1 * (1 - B + B * (dl / avgdl)));
        score += idf * norm;
      }

      if (score > 0) scores.set(key, score);
    }

    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([key, score]) => ({ key, score }));
  }

  get size(): number {
    return this.docs.size;
  }

  private removeKey(key: string): void {
    const tokens = this.docs.get(key);
    if (!tokens) return;
    for (const term of new Set(tokens)) {
      const count = this.df.get(term) ?? 0;
      if (count <= 1) this.df.delete(term);
      else this.df.set(term, count - 1);
    }
    this.docs.delete(key);
  }
}

// 모듈 레벨 싱글턴 (서버 재시작 시 초기화 — vectorStore와 동일 생명주기)
export const bm25Index = new BM25Index();
