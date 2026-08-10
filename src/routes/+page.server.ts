import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { matchAssignments } from '$lib/server/db/schema';
import { teams } from '$lib/server/tournament/team-structure';
import { asc } from 'drizzle-orm';

export const load = () => {
	if (!env.TOURNAMENT_NAME) throw new Error('TOURNAMENT_NAME is not set');

	const assignments = db
		.select()
		.from(matchAssignments)
		.orderBy(asc(matchAssignments.matchNumber), asc(matchAssignments.laneNumber))
		.all();

	return { tournamentName: env.TOURNAMENT_NAME, teams, assignments };
};
