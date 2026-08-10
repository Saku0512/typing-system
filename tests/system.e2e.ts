import { expect, test } from '@playwright/test';

test('reports application, database, and realtime connectivity', async ({ page, request }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: '大会運営' })).toBeVisible();
	await expect(page.locator('.status-row').filter({ hasText: 'データベース' })).toContainText(
		'接続済み'
	);
	await expect(page.locator('.status-row').filter({ hasText: 'リアルタイム通信' })).toContainText(
		'接続済み'
	);

	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	await expect(response.json()).resolves.toMatchObject({ status: 'ok', database: 'connected' });
});
