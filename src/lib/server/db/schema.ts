import { integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const appMetadata = sqliteTable('app_metadata', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
});

export const matchAssignments = sqliteTable(
	'match_assignments',
	{
		matchNumber: integer('match_number').notNull(),
		teamName: text('team_name').notNull(),
		representativeSource: text('representative_source').notNull(),
		laneNumber: integer('lane_number').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.matchNumber, table.teamName] }),
		uniqueIndex('match_assignments_match_lane_unique').on(table.matchNumber, table.laneNumber)
	]
);

export const matchResults = sqliteTable(
	'match_results',
	{
		matchNumber: integer('match_number').notNull(),
		laneNumber: integer('lane_number').notNull(),
		teamName: text('team_name').notNull(),
		representativeSource: text('representative_source').notNull(),
		correctTypes: integer('correct_types').notNull(),
		incorrectTypes: integer('incorrect_types').notNull(),
		completedProblems: integer('completed_problems').notNull(),
		wpm: real('wpm').notNull(),
		accuracy: real('accuracy').notNull(),
		rawScore: real('raw_score').notNull(),
		score: integer('score').notNull(),
		rank: integer('rank').notNull(),
		problemSetId: text('problem_set_id').notNull(),
		problemSetVersion: integer('problem_set_version').notNull(),
		finishedAt: integer('finished_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.matchNumber, table.laneNumber] })]
);

export const matchConfirmations = sqliteTable('match_confirmations', {
	matchNumber: integer('match_number').primaryKey(),
	confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }).notNull(),
	confirmedBy: text('confirmed_by').notNull()
});
