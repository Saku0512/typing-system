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
		database.prepare('delete from result_exports').run();
		database.prepare('delete from match_confirmations').run();
		database.prepare('delete from match_disqualifications').run();
		database.prepare('delete from match_operations').run();
		database.prepare('delete from match_attempt_results').run();
		database.prepare('delete from match_attempts').run();
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
		expect((await admin.request.get('/admin/results.json')).status()).toBe(409);
		const firstMatch = admin.locator('.confirmation-match').first();
		await firstMatch.getByLabel('第1試合の失格対象').selectOption('1');
		await firstMatch.getByPlaceholder('失格の理由').fill('競技規定違反');
		await firstMatch.getByRole('button', { name: '失格', exact: true }).click();
		await expect(admin.getByRole('status')).toContainText('失格を実行しました');
		await expect(
			admin
				.locator('.confirmation-match')
				.first()
				.locator('.confirmation-row')
				.filter({ hasText: '1年生' })
				.locator('strong')
				.first()
		).toHaveText('失格');
		for (const matchNumber of [1, 2, 3]) {
			const match = admin.locator('.confirmation-match').nth(matchNumber - 1);
			await expect(match.getByText('未確定', { exact: true })).toBeVisible();
			await match.getByRole('button', { name: '結果を確定' }).click();
			await expect(admin.getByRole('status')).toHaveText(
				`第${matchNumber}試合の結果を確定しました。`
			);
		}
		await expect(admin.getByRole('heading', { name: '確定結果JSON' })).toBeVisible();
		await expect(admin.getByRole('link', { name: 'JSONを出力' })).toBeVisible();
		const firstExportResponse = await admin.request.get('/admin/results.json');
		expect(firstExportResponse.status()).toBe(200);
		expect(firstExportResponse.headers()['content-disposition']).toContain(
			'filename="typing-results.json"'
		);
		const firstExport = await firstExportResponse.json();
		expect(Object.keys(firstExport)).toEqual(['schema_version', 'export_id', 'teams']);
		expect(firstExport.schema_version).toBe('typing-results-v1');
		expect(firstExport.teams).toHaveLength(6);
		expect(firstExport.teams[0]).toEqual({
			team_name: '2年生',
			match_1_score: 131,
			match_2_score: 132,
			match_3_score: 133,
			total_score: 396,
			rank: 1
		});
		expect(JSON.stringify(firstExport)).not.toContain('representative_source');

		const secondExportResponse = await admin.request.get('/admin/results.json');
		expect(secondExportResponse.headers()['x-export-id']).toBe(firstExport.export_id);
		expect(await secondExportResponse.text()).toBe(await firstExportResponse.text());
		await admin.reload();
		await expect(admin.getByRole('link', { name: 'JSONを再出力' })).toBeVisible();
		await expect(admin.locator('.export-history-row')).toContainText('2回');

		await expect(page.getByRole('heading', { name: '総合順位' })).toBeVisible();
		await expect(page.locator('.overall-total').first()).toContainText('396');
		await expect(page.getByRole('region', { name: '第1試合' }).getByText('失格')).toBeVisible();
	} finally {
		await adminContext.close();
		const cleanupDatabase = new Database(databaseUrl);
		cleanupDatabase.transaction(() => {
			cleanupDatabase.prepare('delete from result_exports').run();
			cleanupDatabase.prepare('delete from match_confirmations').run();
			cleanupDatabase.prepare('delete from match_disqualifications').run();
			cleanupDatabase.prepare('delete from match_operations').run();
			cleanupDatabase.prepare('delete from match_attempt_results').run();
			cleanupDatabase.prepare('delete from match_attempts').run();
			cleanupDatabase.prepare('delete from match_results').run();
		})();
		cleanupDatabase.close();
	}
});

test('synchronizes six competition terminals with monitoring', async ({ browser }) => {
	const database = new Database(databaseUrl);
	database.transaction(() => {
		database.prepare('delete from result_exports').run();
		database.prepare('delete from match_confirmations').run();
		database.prepare('delete from match_disqualifications').run();
		database.prepare('delete from match_operations').run();
		database.prepare('delete from match_attempt_results').run();
		database.prepare('delete from match_attempts').run();
		database.prepare('delete from match_results').run();
	})();
	database.close();

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
			await expect(terminal.getByText('接続済み', { exact: true })).toBeVisible();
			await terminal.getByRole('button', { name: '準備完了' }).click();
			await expect(terminal.getByText('全員の準備を待っています')).toBeVisible();
		}
	}

	await expect(monitor.getByText('6/6 準備')).toBeVisible();
	await expect(terminals[0].getByText('全員の準備を待っています')).toBeVisible();
	await expect(terminals[0].getByText('競技中', { exact: true })).toHaveCount(0);

	const adminContext = await browser.newContext({
		httpCredentials: { username: adminUsername, password: adminPassword }
	});
	const admin = await adminContext.newPage();
	await admin.goto('/admin');
	const firstMatchControl = admin
		.locator('.competition-control-row')
		.filter({ hasText: '第1試合' });
	await expect(firstMatchControl.locator('.competition-count')).toHaveText([/6\/6/, /6\/6/]);
	admin.on('dialog', (dialog) => dialog.accept());
	await firstMatchControl.getByRole('button', { name: '一括開始' }).click();
	await expect(admin.getByRole('status')).toHaveText('第1試合を開始しました。');
	const lockedAssignmentResult = await admin.evaluate(
		async (assignments) => {
			const response = await fetch('/admin?/saveAssignments', {
				method: 'POST',
				redirect: 'manual',
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' },
				body: new URLSearchParams(assignments)
			});
			return response.json();
		},
		{
			source_1_0: '1-2',
			source_1_1: 'IS2',
			source_1_2: 'IS3',
			source_1_3: 'IS4',
			source_1_4: 'IS5',
			source_1_5: '専教',
			source_2_0: '1-1',
			source_2_1: 'IT2',
			source_2_2: 'IT3',
			source_2_3: 'IT4',
			source_2_4: 'IT5',
			source_2_5: '専教',
			source_3_0: '1-3',
			source_3_1: 'IE2',
			source_3_2: 'IE3',
			source_3_3: 'IE4',
			source_3_4: 'IE5',
			source_3_5: '専教'
		}
	);
	expect(lockedAssignmentResult).toMatchObject({ type: 'failure', status: 409 });

	await expect(terminals[0].getByText('競技中', { exact: true })).toBeVisible({ timeout: 6_000 });
	await terminals[1].reload();
	await expect(terminals[1].getByLabel('出場クラス')).toHaveValue('IS2');
	await expect(terminals[1].getByRole('heading', { name: /2年生/ })).toBeVisible();
	await expect(terminals[1].getByText('競技中', { exact: true })).toBeVisible();
	await terminals[0].getByLabel('タイピング入力').pressSequentially('aozora', { delay: 50 });

	const firstLane = monitor.getByRole('region', { name: 'レーン1 1年生' });
	await expect(firstLane.getByText('靴音')).toBeVisible();
	await expect(firstLane.locator('.monitor-metrics dd').first()).toHaveText('6');
	await expect(firstLane.getByText(/位$/)).toHaveCount(0);
	await expect(terminals[0].getByText('最終順位')).toHaveCount(0);

	await firstMatchControl.getByRole('button', { name: '中断', exact: true }).click();
	await expect(terminals[0].getByText('競技中断', { exact: true })).toBeVisible();
	await expect(firstMatchControl.getByText('中断', { exact: true })).toBeVisible();

	await firstMatchControl.getByPlaceholder('無効化の理由').fill('通信障害');
	await firstMatchControl.getByRole('button', { name: '無効化' }).click();
	await expect(terminals[0].getByText('試技無効', { exact: true })).toBeVisible();

	await firstMatchControl.getByPlaceholder('再試合の理由').fill('通信復旧後に再実施');
	await firstMatchControl.getByRole('button', { name: '再試合' }).click();
	await expect(firstMatchControl).toContainText('試技2 / typing-reserve-01');
	for (const terminal of terminals) {
		await expect(terminal.getByRole('button', { name: '準備完了' })).toBeVisible();
		await terminal.getByRole('button', { name: '準備完了' }).click();
	}
	await expect(firstMatchControl.locator('.competition-count')).toHaveText([/6\/6/, /6\/6/]);
	await firstMatchControl.getByRole('button', { name: '一括開始' }).click();
	await expect(terminals[0].getByText('競技中', { exact: true })).toBeVisible({ timeout: 6_000 });
	await firstMatchControl.getByRole('button', { name: '強制終了' }).click();
	await expect(terminals[0].getByText('強制終了', { exact: true })).toBeVisible();
	await expect(admin.getByRole('heading', { name: '試行・操作履歴' })).toBeVisible();
	await expect(admin.locator('.attempt-history-item')).toHaveCount(2);
	const retryAttempt = admin.locator('.attempt-history-item').filter({
		hasText: 'typing-reserve-01'
	});
	await retryAttempt.locator('summary').click();
	await expect(retryAttempt.locator('.attempt-result-row')).toHaveCount(7);
	await expect(admin.locator('.operation-history-row')).toHaveCount(6);

	for (const terminalContext of terminalContexts) await terminalContext.close();
	await adminContext.close();
	await monitorContext.close();
});
