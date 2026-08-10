import { expect, test } from '@playwright/test';

process.loadEnvFile?.();
const tournamentName = process.env.TOURNAMENT_NAME;
if (!tournamentName) throw new Error('TOURNAMENT_NAME is not set');

test('loads the configured tournament and reports database connectivity', async ({
	page,
	request
}) => {
	await page.goto('/');

	await expect(page.locator('h1')).toHaveText(tournamentName);
	await expect(page.getByRole('heading', { name: '出場枠' })).toBeVisible();
	await expect(page.getByText('1-1_1', { exact: true })).toBeVisible();
	await expect(page.getByText('専教_3', { exact: true })).toBeVisible();

	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	await expect(response.json()).resolves.toMatchObject({ status: 'ok', database: 'connected' });
});
