import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { confirmMatchResults } from './result-confirmation.js';

function createDatabase() {
	const database = new Database(':memory:');
	database.exec(`
		create table match_results (
			match_number integer not null,
			lane_number integer not null,
			primary key (match_number, lane_number)
		);
		create table match_confirmations (
			match_number integer primary key,
			confirmed_at integer not null,
			confirmed_by text not null
		)
	`);
	return database;
}

describe('match result confirmation', () => {
	it('requires all six results', () => {
		const database = createDatabase();
		for (let laneNumber = 1; laneNumber <= 5; laneNumber += 1) {
			database.prepare('insert into match_results values (1, ?)').run(laneNumber);
		}

		expect(confirmMatchResults(database, 1, 'admin', 1_000)).toEqual({
			confirmed: false,
			reason: 'incomplete_results'
		});
		expect(database.prepare('select * from match_confirmations').all()).toEqual([]);
		database.close();
	});

	it('confirms six results once and preserves the original audit values', () => {
		const database = createDatabase();
		for (let laneNumber = 1; laneNumber <= 6; laneNumber += 1) {
			database.prepare('insert into match_results values (1, ?)').run(laneNumber);
		}

		expect(confirmMatchResults(database, 1, 'admin', 1_000)).toEqual({
			confirmed: true,
			alreadyConfirmed: false
		});
		expect(confirmMatchResults(database, 1, 'another-admin', 2_000)).toEqual({
			confirmed: true,
			alreadyConfirmed: true
		});
		expect(
			database
				.prepare(
					'select match_number as matchNumber, confirmed_at as confirmedAt, confirmed_by as confirmedBy from match_confirmations'
				)
				.all()
		).toEqual([{ matchNumber: 1, confirmedAt: 1_000, confirmedBy: 'admin' }]);
		database.close();
	});
});
