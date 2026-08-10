import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { matchConfirmations, matchResults } from '$lib/server/db/schema';

export function getMatchResults() {
	return db
		.select()
		.from(matchResults)
		.orderBy(asc(matchResults.matchNumber), asc(matchResults.rank), asc(matchResults.laneNumber))
		.all();
}

export function getMatchConfirmations() {
	return db.select().from(matchConfirmations).orderBy(asc(matchConfirmations.matchNumber)).all();
}
