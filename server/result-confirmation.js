/**
 * @param {import('better-sqlite3').Database} database
 * @param {number} matchNumber
 * @param {string} confirmedBy
 * @param {number} confirmedAt
 */
export function confirmMatchResults(database, matchNumber, confirmedBy, confirmedAt = Date.now()) {
	const confirm = database.transaction(() => {
		const resultCount = database
			.prepare('select count(*) from match_results where match_number = ?')
			.pluck()
			.get(matchNumber);
		if (resultCount !== 6) return { confirmed: false, reason: 'incomplete_results' };

		const existing = database
			.prepare('select 1 from match_confirmations where match_number = ?')
			.get(matchNumber);
		if (existing) return { confirmed: true, alreadyConfirmed: true };

		database
			.prepare(
				'insert into match_confirmations (match_number, confirmed_at, confirmed_by) values (?, ?, ?)'
			)
			.run(matchNumber, confirmedAt, confirmedBy);
		return { confirmed: true, alreadyConfirmed: false };
	});

	return confirm();
}
