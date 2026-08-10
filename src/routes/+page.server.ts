import { env } from '$env/dynamic/private';
import { getMatchResults } from '$lib/server/tournament/match-results';
import { getSavedAssignments } from '$lib/server/tournament/saved-assignments';
import { createTeamStandings } from '$lib/server/tournament/team-ranking';
import { teams } from '$lib/server/tournament/team-structure';

export const load = () => {
	if (!env.TOURNAMENT_NAME) throw new Error('TOURNAMENT_NAME is not set');

	const results = getMatchResults();
	return {
		tournamentName: env.TOURNAMENT_NAME,
		teams,
		assignments: getSavedAssignments(),
		results,
		teamStandings: createTeamStandings(
			results,
			teams.map((team) => team.name)
		)
	};
};
