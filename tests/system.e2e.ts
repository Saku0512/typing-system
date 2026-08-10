import { expect, test } from '@playwright/test';

process.loadEnvFile?.();
const tournamentName = process.env.TOURNAMENT_NAME;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
if (!tournamentName || !adminUsername || !adminPassword) {
	throw new Error('TOURNAMENT_NAME, ADMIN_USERNAME, and ADMIN_PASSWORD must be set');
}

test('loads the configured tournament and reports database connectivity', async ({
	page,
	request
}) => {
	await page.goto('/');

	await expect(page.locator('h1')).toHaveText(tournamentName);
	await expect(page.getByRole('heading', { name: '出場枠' })).toBeVisible();
	await expect(page.getByText('1-1', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('専教', { exact: true }).first()).toBeVisible();

	const response = await request.get('/api/health');
	expect(response.ok()).toBe(true);
	await expect(response.json()).resolves.toMatchObject({ status: 'ok', database: 'connected' });
});

test('protects the admin screen and saves valid assignments', async ({ browser, request }) => {
	const unauthorized = await request.get('/admin');
	expect(unauthorized.status()).toBe(401);
	expect(unauthorized.headers()['www-authenticate']).toContain('Basic');

	const context = await browser.newContext({
		httpCredentials: { username: adminUsername, password: adminPassword }
	});
	const page = await context.newPage();
	await page.goto('/admin');

	await expect(page.getByRole('heading', { name: '大会管理' })).toBeVisible();
	await expect(page.getByRole('heading', { name: '第1試合' })).toBeVisible();
	await expect(page.locator('select[name="source_1_1"]')).toHaveValue('IS2');
	await page.getByRole('button', { name: '保存' }).first().click();
	await expect(page.getByRole('status')).toHaveText('保存しました。');

	await context.close();
});
