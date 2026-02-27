import '@testing-library/jest-dom';

// 환경변수 기본값 설정 (테스트 격리)
process.env.EMBEDDING_PROVIDER = 'mock';
process.env.DATABASE_URL = '';
// NODE_ENV는 Jest가 자동으로 'test'로 설정하므로 별도 지정 불필요
