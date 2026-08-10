import { env } from '$env/dynamic/private';
import { teams } from '$lib/server/tournament/team-structure';

export const load = () => {
	if (!env.TOURNAMENT_NAME) throw new Error('TOURNAMENT_NAME is not set');

	return { tournamentName: env.TOURNAMENT_NAME, teams };
};
