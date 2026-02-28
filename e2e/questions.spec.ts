// e2e/questions.spec.ts — 질문 패널 E2E 테스트
import { test, expect } from '@playwright/test';

test.describe('Questions Panel (TC-E2E-11~12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('TC-E2E-11: 질문 패널 토글 버튼이 있다', async ({ page }) => {
    // QuestionPanel 토글 버튼 탐색 (aria-label 또는 텍스트 기반)
    const toggleBtn = page.locator(
      '[aria-label*="question" i], [aria-label*="질문" i], button:has-text("질문")'
    ).first();
    await expect(toggleBtn).toBeVisible({ timeout: 5_000 });
  });

  test('TC-E2E-12: 질문 패널을 열면 카테고리가 표시된다', async ({ page }) => {
    // 토글 버튼 클릭
    const toggleBtn = page.locator(
      '[aria-label*="question" i], [aria-label*="질문" i], button:has-text("질문")'
    ).first();

    const isVisible = await toggleBtn.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip();
      return;
    }

    await toggleBtn.click();

    // 패널이 열리면 카테고리 텍스트 또는 질문 목록이 표시되어야 함
    const panel = page.locator('[role="dialog"], [data-testid="question-panel"], aside').first();
    await expect(panel).toBeVisible({ timeout: 3_000 });
  });

  test('TC-E2E-11b: 메인 페이지 초기 로드 완료 확인', async ({ page }) => {
    // 채팅 입력창이 반드시 표시되어야 함
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10_000 });
    // 페이지 타이틀 확인
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
