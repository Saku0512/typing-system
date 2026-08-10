import { checkDatabase } from '$lib/server/db';

export const load = () => ({
	databaseConnected: checkDatabase(),
	serverTime: new Date().toISOString()
});
