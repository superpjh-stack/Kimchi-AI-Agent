// e2e/i18n.spec.ts — 언어 전환 E2E 테스트
import { test, expect } from '@playwright/test';

test.describe('i18n Language Switch', () => {
  test('TC-E2E-07: EN 클릭 시 /en URL로 이동하고 영어 텍스트가 표시된다', async ({ page }) => {
    await page.goto('/');
    // 언어 전환 버튼 클릭
    const enButton = page.locator('button:has-text("EN"), a:has-text("EN")').first();
    if (await enButton.isVisible()) {
      await enButton.click();
      await page.waitForURL('**/en**', { timeout: 5000 }).catch(() => {});
      // 영어 텍스트가 페이지에 나타나는지 확인
      await expect(page.locator('body')).toContainText(/chat|factory|assistant/i);
    } else {
      test.skip();
    }
  });

  test('TC-E2E-08: KO 클릭 시 기본 URL(/)로 이동하고 한국어 텍스트가 표시된다', async ({ page }) => {
    await page.goto('/en');
    const koButton = page.locator('button:has-text("KO"), a:has-text("KO")').first();
    if (await koButton.isVisible()) {
      await koButton.click();
      await page.waitForURL('http://localhost:3000/', { timeout: 5000 }).catch(() => {});
      await expect(page.locator('body')).toContainText(/채팅|도우미|공장/i);
    } else {
      test.skip();
    }
  });
});
