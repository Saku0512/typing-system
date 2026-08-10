import { describe, expect, it } from 'vitest';
import { createIndividualRanks } from './competition.js';

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
