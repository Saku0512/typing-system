import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createIndividualRanks, publishedRank, saveMatchResults } from './competition.js';

type Result = {
	laneNumber: number;
	score: number;
	correctTypes: number;
	incorrectTypes: number;
};

function ranksFor(results: Result[]) {
	return [...createIndividualRanks(results).values()];
}

describe('individual competition ranking', () => {
	it('publishes ranks only after the competition finishes', () => {
		expect(publishedRank('waiting', 1)).toBeNull();
		expect(publishedRank('countdown', 1)).toBeNull();
		expect(publishedRank('running', 1)).toBeNull();
		expect(publishedRank('finished', 1)).toBe(1);
	});

	it('uses the raw score when integer scores are tied', () => {
		expect(
			ranksFor([
				{ laneNumber: 1, score: 100, correctTypes: 301, incorrectTypes: 0 },
				{ laneNumber: 2, score: 100, correctTypes: 300, incorrectTypes: 0 }
			])
		).toEqual([1, 2]);
	});

	it('uses accuracy when raw scores are tied', () => {
		expect(
			ranksFor([
				{ laneNumber: 1, score: 0, correctTypes: 8, incorrectTypes: 8 },
				{ laneNumber: 2, score: 0, correctTypes: 1, incorrectTypes: 0 }
			])
		).toEqual([2, 1]);
	});

	it('uses fewer incorrect types after the other metrics tie', () => {
		expect(
			ranksFor([
				{ laneNumber: 1, score: 0, correctTypes: 0, incorrectTypes: 2 },
				{ laneNumber: 2, score: 0, correctTypes: 0, incorrectTypes: 1 }
			])
		).toEqual([2, 1]);
	});

	it('shares a rank only when all comparison values are equal', () => {
		expect(
			ranksFor([
				{ laneNumber: 1, score: 100, correctTypes: 300, incorrectTypes: 0 },
				{ laneNumber: 2, score: 100, correctTypes: 300, incorrectTypes: 0 },
				{ laneNumber: 3, score: 50, correctTypes: 150, incorrectTypes: 0 }
			])
		).toEqual([1, 1, 3]);
	});
});

describe('finished competition results', () => {
	it('replaces the saved results for a match atomically', () => {
		const database = new Database(':memory:');
		database.exec(`
			create table match_confirmations (
				match_number integer primary key,
				confirmed_at integer not null,
				confirmed_by text not null
			);
			create table match_results (
				match_number integer not null,
				lane_number integer not null,
				team_name text not null,
				representative_source text not null,
				correct_types integer not null,
				incorrect_types integer not null,
				completed_problems integer not null,
				wpm real not null,
				accuracy real not null,
				raw_score real not null,
				score integer not null,
				rank integer not null,
				problem_set_id text not null,
				problem_set_version integer not null,
				finished_at integer not null,
				primary key (match_number, lane_number)
			)
		`);

		const result = (laneNumber: number, rank: number, score: number) => ({
			laneNumber,
			teamName: `${laneNumber}年生`,
			representativeSource: `IS${laneNumber}`,
			correctTypes: score,
			incorrectTypes: 0,
			completedProblems: 1,
			wpm: score / 3,
			accuracy: 1,
			rawScore: score + 0.5,
			score,
			rank
		});
		const snapshot = (lanes: ReturnType<typeof result>[]) => ({
			matchNumber: 1,
			problemSetId: 'match-1-main-v1',
			problemSetVersion: 1,
			lanes
		});

		saveMatchResults(database, snapshot([result(1, 1, 120), result(2, 1, 120)]), 1_000);
		saveMatchResults(database, snapshot([result(2, 1, 130)]), 2_000);

		expect(
			database
				.prepare(
					'select lane_number as laneNumber, rank, score, finished_at as finishedAt from match_results'
				)
				.all()
		).toEqual([{ laneNumber: 2, rank: 1, score: 130, finishedAt: 2_000 }]);

		database.prepare('insert into match_confirmations values (1, 2000, ?)').run('admin');
		expect(() => saveMatchResults(database, snapshot([result(1, 1, 140)]), 3_000)).toThrow(
			'Results for match 1 are already confirmed'
		);
		database.close();
	});
});
