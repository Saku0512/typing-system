import { integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
