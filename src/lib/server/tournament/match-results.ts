import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { matchResults } from '$lib/server/db/schema';

export function getMatchResults() {
	return db
		.select()
		.from(matchResults)
		.orderBy(asc(matchResults.matchNumber), asc(matchResults.rank), asc(matchResults.laneNumber))
		.all();
}
