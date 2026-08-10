import { expect, test } from '@playwright/test';
import Database from 'better-sqlite3';

test.describe.configure({ mode: 'serial' });

if (!process.env.TOURNAMENT_NAME || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
	try {
		process.loadEnvFile?.();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			throw error;
		}
	}
}
const tournamentName = process.env.TOURNAMENT_NAME;
const adminUsername = process.env.ADMIN_USERNAME;
const adminPassword = process.env.ADMIN_PASSWORD;
const databaseUrl = process.env.DATABASE_URL ?? 'data/e2e.db';
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
	await expect(
		page.locator('.match-editor').first().getByRole('heading', { name: '第1試合' })
	).toBeVisible();
	await expect(page.locator('select[name="source_1_1"]')).toHaveValue('IS2');
	await page.getByRole('button', { name: '保存' }).first().click();
	await expect(page.getByRole('status')).toHaveText('保存しました。');

	await page.goto('/');
	await expect(page.getByRole('heading', { name: '試合・レーン情報' })).toBeVisible();
	const firstMatch = page.getByRole('region', { name: '第1試合' });
	await expect(firstMatch.getByText('1', { exact: true })).toBeVisible();
	await expect(firstMatch.getByText('1年生', { exact: true })).toBeVisible();
	await expect(firstMatch.getByText('1-1', { exact: true })).toBeVisible();

	await context.close();
});

test('confirms finished matches manually before publishing overall standings', async ({
	browser,
	page
}) => {
	const database = new Database(databaseUrl);
	const insertResult = database.prepare(`
		insert into match_results (
			match_number, lane_number, team_name, representative_source,
			correct_types, incorrect_types, completed_problems,
			wpm, accuracy, raw_score, score, rank,
			problem_set_id, problem_set_version, finished_at
		) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	const teams = [
		{ name: '1年生', source: '1-1' },
		{ name: '2年生', source: 'IS2' },
		{ name: '3年生', source: 'IS3' },
		{ name: '4年生', source: 'IS4' },
		{ name: '5年生', source: 'IS5' },
		{ name: '専攻科・教員', source: '専教' }
	];
	database.transaction(() => {
		database.prepare('delete from match_confirmations').run();
		database.prepare('delete from match_results').run();
		for (const matchNumber of [1, 2, 3]) {
			for (const [teamIndex, team] of teams.entries()) {
				const laneNumber = teamIndex + 1;
				const score = 150 - laneNumber * 10 + matchNumber;
				insertResult.run(
					matchNumber,
					laneNumber,
					team.name,
					team.source,
					420 - laneNumber * 10,
					5 + laneNumber,
					12,
					140 - laneNumber * 5,
					0.98 - laneNumber * 0.002,
					score + 0.5,
					score,
					laneNumber,
					`match-${matchNumber}-main-v1`,
					1,
					Date.now()
				);
			}
		}
	})();
	database.close();

	const adminContext = await browser.newContext({
		httpCredentials: { username: adminUsername, password: adminPassword }
	});
	const admin = await adminContext.newPage();
	try {
		await page.goto('/');
		await expect(page.getByText('未確定', { exact: true })).toHaveCount(3);
		await expect(page.getByRole('heading', { name: '総合順位' })).toHaveCount(0);

		await admin.goto('/admin');
		admin.on('dialog', (dialog) => dialog.accept());
		for (const matchNumber of [1, 2, 3]) {
			const match = admin.locator('.confirmation-match').nth(matchNumber - 1);
			await expect(match.getByText('未確定', { exact: true })).toBeVisible();
			await match.getByRole('button', { name: '結果を確定' }).click();
			await expect(admin.getByRole('status')).toHaveText(
				`第${matchNumber}試合の結果を確定しました。`
			);
		}

		await expect(page.getByRole('heading', { name: '総合順位' })).toBeVisible();
		await expect(page.locator('.overall-total').first()).toContainText('426');
	} finally {
		await adminContext.close();
		const cleanupDatabase = new Database(databaseUrl);
		cleanupDatabase.transaction(() => {
			cleanupDatabase.prepare('delete from match_confirmations').run();
			cleanupDatabase.prepare('delete from match_results').run();
		})();
		cleanupDatabase.close();
	}
});

test('synchronizes six competition terminals with monitoring', async ({ browser }) => {
	const monitorContext = await browser.newContext();
	const monitor = await monitorContext.newPage();
	await monitor.goto('/monitoring');
	const navigation = monitor.getByRole('navigation', { name: 'メインナビゲーション' });
	await expect(navigation).toContainText('モニタリング');
	await expect(navigation).toContainText('競技');

	const terminals = [];
	const terminalContexts = [];
	for (const representativeSource of ['1-1', 'IS2', 'IS3', 'IS4', 'IS5', '専教']) {
		const terminalContext = await browser.newContext();
		terminalContexts.push(terminalContext);
		const terminal = await terminalContext.newPage();
		terminals.push(terminal);
		await terminal.goto('/competition');
		await terminal.getByLabel('出場クラス').selectOption(representativeSource);
		await terminal.getByRole('button', { name: '端末を接続' }).click();
		await terminal.getByRole('button', { name: '準備完了' }).click();
		if (representativeSource === '1-1') {
			await terminal.reload();
			await expect(terminal.getByLabel('出場クラス')).toHaveValue('1-1');
			await expect(terminal.getByText('全員の準備を待っています')).toBeVisible();
		}
	}

	await expect(monitor.getByText('6/6 準備')).toBeVisible();
	await expect(terminals[0].getByText('競技中', { exact: true })).toBeVisible({ timeout: 6_000 });
	await terminals[1].reload();
	await expect(terminals[1].getByLabel('出場クラス')).toHaveValue('IS2');
	await expect(terminals[1].getByRole('heading', { name: /2年生/ })).toBeVisible();
	await expect(terminals[1].getByText('競技中', { exact: true })).toBeVisible();
	await terminals[0].getByLabel('タイピング入力').pressSequentially('aozora');

	const firstLane = monitor.getByRole('region', { name: 'レーン1 1年生' });
	await expect(firstLane.getByText('靴音')).toBeVisible();
	await expect(firstLane.locator('.monitor-metrics dd').first()).toHaveText('6');
	await expect(firstLane.getByText(/位$/)).toHaveCount(0);
	await expect(terminals[0].getByText('最終順位')).toHaveCount(0);

	for (const terminalContext of terminalContexts) await terminalContext.close();
	await monitorContext.close();
});
