import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'node',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },

  collectCoverageFrom: [
    'lib/rag/embedder.ts',
    'lib/rag/retriever.ts',
    'lib/ml/rule-based-predictor.ts',
    'lib/ml/predictor-factory.ts',
    'lib/ml/prediction-cache.ts',
    'lib/auth/rbac.ts',
    'lib/auth/jwt.ts',
    'lib/security/input-sanitizer.ts',
    'lib/security/file-validator.ts',
  ],

  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.tsx',
  ],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  transformIgnorePatterns: [
    '/node_modules/(?!(jose|some-esm-module)/)',
  ],
};

export default createJestConfig(config);
