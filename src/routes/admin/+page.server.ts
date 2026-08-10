import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { matchAssignments } from '$lib/server/db/schema';
import {
	createDefaultAssignments,
	type MatchAssignment,
	validateAssignments
} from '$lib/server/tournament/match-assignments';
import { getMatchConfirmations, getMatchResults } from '$lib/server/tournament/match-results';
import { teams } from '$lib/server/tournament/team-structure';
import { asc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import { requestCompetitionStart } from '../../../server/competition-controls.js';
import { confirmMatchResults } from '../../../server/result-confirmation.js';
import { publishResultNotification } from '../../../server/result-notifications.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!env.TOURNAMENT_NAME) throw new Error('TOURNAMENT_NAME is not set');

	const savedAssignments = db
		.select()
		.from(matchAssignments)
		.orderBy(asc(matchAssignments.matchNumber), asc(matchAssignments.laneNumber))
		.all();

	return {
		tournamentName: env.TOURNAMENT_NAME,
		teams,
		assignments: savedAssignments.length > 0 ? savedAssignments : createDefaultAssignments(),
		results: getMatchResults(),
		confirmations: getMatchConfirmations()
	};
};

export const actions = {
	saveAssignments: async ({ request }) => {
		const formData = await request.formData();
		const assignments: MatchAssignment[] = [1, 2, 3].flatMap((matchNumber) =>
			teams.map((team, teamIndex) => ({
				matchNumber,
				teamName: team.name,
				representativeSource: String(formData.get(`source_${matchNumber}_${teamIndex}`) ?? ''),
				laneNumber: team.laneNumber
			}))
		);

		const issues = validateAssignments(assignments);
		if (issues.length > 0) return fail(400, { issues, assignments });

		const updatedAt = new Date();
		db.transaction((transaction) => {
			transaction.delete(matchAssignments).run();
			transaction
				.insert(matchAssignments)
				.values(assignments.map((assignment) => ({ ...assignment, updatedAt })))
				.run();
		});

		return { saved: true };
	},
	startCompetition: async ({ request }) => {
		const formData = await request.formData();
		const matchNumber = Number(formData.get('matchNumber'));
		if (!Number.isInteger(matchNumber) || matchNumber < 1 || matchNumber > 3) {
			return fail(400, { startIssue: '試合番号が正しくありません。' });
		}
		if (getMatchResults().some((result) => result.matchNumber === matchNumber)) {
			return fail(409, { startIssue: `第${matchNumber}試合はすでに終了しています。` });
		}

		const result = requestCompetitionStart(matchNumber);
		if (!result.started) {
			const message =
				result.reason === 'not_ready'
					? `第${matchNumber}試合は全員の接続・準備が完了していません。`
					: result.reason === 'invalid_status'
						? `第${matchNumber}試合はすでに開始されています。`
						: result.reason === 'assignments_incomplete'
							? `第${matchNumber}試合の割り当てが不足しています。`
							: `第${matchNumber}試合の選手端末が接続されていません。`;
			return fail(409, { startIssue: message });
		}

		return { started: true, startedMatchNumber: matchNumber };
	},
	confirmResults: async ({ request }) => {
		const formData = await request.formData();
		const matchNumber = Number(formData.get('matchNumber'));
		if (!Number.isInteger(matchNumber) || matchNumber < 1 || matchNumber > 3) {
			return fail(400, { confirmationIssue: '試合番号が正しくありません。' });
		}
		if (!env.ADMIN_USERNAME) throw new Error('ADMIN_USERNAME is not set');

		const databaseUrl = env.DATABASE_URL ?? 'data/typing-system.db';
		const database = new Database(databaseUrl);
		database.pragma('busy_timeout = 5000');
		try {
			const result = confirmMatchResults(database, matchNumber, env.ADMIN_USERNAME);
			if (!result.confirmed) {
				return fail(409, {
					confirmationIssue: `第${matchNumber}試合は6名分の結果が揃っていません。`
				});
			}
		} finally {
			database.close();
		}

		publishResultNotification({
			type: 'competition.confirmed',
			data: { matchNumber }
		});
		return { confirmed: true, confirmedMatchNumber: matchNumber };
	}
} satisfies Actions;
