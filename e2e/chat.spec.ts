// e2e/chat.spec.ts — 채팅 흐름 E2E 테스트
import { test, expect } from '@playwright/test';

test.describe('Chat Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC-E2E-04: 페이지 로드 시 채팅 입력창이 보인다', async ({ page }) => {
    await expect(page.locator('textarea, input[type="text"]').first()).toBeVisible();
  });

  test('TC-E2E-05: Quick Questions 버튼이 존재한다', async ({ page }) => {
    // QuestionPanel 토글 버튼 확인
    const btn = page.locator('[aria-label*="question" i], [aria-label*="질문" i]').first();
    await expect(btn).toBeVisible();
  });

  test('TC-E2E-06: 언어 전환 버튼이 표시된다', async ({ page }) => {
    const langBtn = page.locator('[aria-label*="language" i], [aria-label*="언어" i]').first();
    await expect(langBtn).toBeVisible();
  });
});
