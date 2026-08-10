import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { matchAssignments } from '$lib/server/db/schema';
import {
	createDefaultAssignments,
	type MatchAssignment,
	validateAssignments
} from '$lib/server/tournament/match-assignments';
import { teams } from '$lib/server/tournament/team-structure';
import { asc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
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
		assignments: savedAssignments.length > 0 ? savedAssignments : createDefaultAssignments()
	};
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const assignments: MatchAssignment[] = [1, 2, 3].flatMap((matchNumber) =>
			teams.map((team, teamIndex) => ({
				matchNumber,
				teamName: team.name,
				representativeSource: String(formData.get(`source_${matchNumber}_${teamIndex}`) ?? ''),
				laneNumber: Number(formData.get(`lane_${matchNumber}_${teamIndex}`))
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
	}
} satisfies Actions;
