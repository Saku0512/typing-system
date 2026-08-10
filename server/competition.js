import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { WebSocket } from 'ws';
import { applyTypingEvent, createTypingState, getTypingView } from './typing-engine.js';

/**
 * @typedef {{ problem_id: string, display_text: string, reading: string }} ProblemPresetEntry
 * @typedef {{ problem_set_id: string, version: number, role: 'main' | 'reserve', match_number?: number, problems: ProblemPresetEntry[] }} ProblemPreset
 * @typedef {{ laneNumber: number, teamName: string, representativeSource: string }} Assignment
 */

/** @type {{ duration_seconds: number, presets: ProblemPreset[] }} */
const problemPresets = JSON.parse(
	readFileSync(new URL('../docs/typing-problem-presets-v1.json', import.meta.url), 'utf8')
);
const durationSeconds = problemPresets.duration_seconds;
const countdownMilliseconds = 3_000;
/** @type {Map<number, ProblemPreset>} */
const mainPresets = new Map(
	problemPresets.presets
		.filter((preset) => preset.role === 'main' && preset.match_number !== undefined)
		.map((preset) => [preset.match_number ?? 0, preset])
);

export function createCompetitionManager() {
	const rooms = new Map();
	const connections = new WeakMap();

	return {
		/** @param {WebSocket} webSocket @param {any} message */
		handle(webSocket, message) {
			if (message.type === 'monitor.subscribe') {
				leaveCurrentConnection(webSocket);
				const room = roomFor(message.data.matchNumber);
				room.monitors.add(webSocket);
				connections.set(webSocket, { role: 'monitor', room });
				sendSnapshot(room, webSocket);
				return true;
			}

			if (message.type === 'typing.join') {
				leaveCurrentConnection(webSocket);
				const room = roomFor(message.data.matchNumber);
				const lane = room.lanes.get(message.data.laneNumber);
				if (!lane) {
					send(webSocket, {
						type: 'system.error',
						data: { code: 'assignment_not_found' }
					});
					return true;
				}

				if (lane.webSocket && lane.webSocket !== webSocket) {
					send(lane.webSocket, { type: 'system.error', data: { code: 'lane_reconnected' } });
				}
				lane.webSocket = webSocket;
				lane.connected = true;
				connections.set(webSocket, { role: 'player', room, lane });
				startWhenReady(room);
				send(webSocket, {
					type: 'typing.joined',
					data: { matchNumber: room.matchNumber, laneNumber: lane.laneNumber }
				});
				broadcastSnapshot(room);
				return true;
			}

			const connection = connections.get(webSocket);
			if (message.type === 'typing.ready') {
				if (connection?.role !== 'player' || connection.room.status !== 'waiting') return true;
				connection.lane.ready = true;
				startWhenReady(connection.room);
				broadcastSnapshot(connection.room);
				return true;
			}

			if (message.type === 'typing.input') {
				if (connection?.role !== 'player' || connection.room.status !== 'running') return true;
				const now = Date.now();
				if (now >= connection.room.endsAt) finishRoom(connection.room);
				else {
					const result = applyTypingEvent(
						connection.lane.typingState,
						{ type: 'key', ...message.data },
						now,
						connection.room.startsAt,
						connection.room.endsAt
					);
					if (result.accepted) {
						send(webSocket, { type: 'typing.input-result', data: result });
						broadcastSnapshot(connection.room);
					}
				}
				return true;
			}

			return false;
		},

		/** @param {WebSocket} webSocket */
		disconnect(webSocket) {
			leaveCurrentConnection(webSocket);
		}
	};

	/** @param {number} matchNumber */
	function roomFor(matchNumber) {
		let room = rooms.get(matchNumber);
		if (room) return room;

		const preset = mainPresets.get(matchNumber);
		if (!preset) throw new Error(`Problem preset for match ${matchNumber} was not found`);
		const problems = preset.problems.map((problem) => ({
			displayText: problem.display_text,
			reading: problem.reading
		}));
		const assignments = loadAssignments(matchNumber);
		room = {
			matchNumber,
			problemSetId: preset.problem_set_id,
			problemSetVersion: preset.version,
			status: 'waiting',
			startsAt: null,
			endsAt: null,
			ticker: null,
			monitors: new Set(),
			lanes: new Map(
				assignments.map((assignment) => [
					assignment.laneNumber,
					{
						...assignment,
						connected: false,
						ready: false,
						webSocket: null,
						typingState: createTypingState(problems)
					}
				])
			)
		};
		rooms.set(matchNumber, room);
		return room;
	}

	/** @param {WebSocket} webSocket */
	function leaveCurrentConnection(webSocket) {
		const connection = connections.get(webSocket);
		if (!connection) return;
		connections.delete(webSocket);

		if (connection.role === 'monitor') {
			connection.room.monitors.delete(webSocket);
			return;
		}

		if (connection.lane.webSocket !== webSocket) return;
		connection.lane.webSocket = null;
		connection.lane.connected = false;
		if (connection.room.status === 'countdown' && Date.now() < connection.room.startsAt) {
			connection.room.status = 'waiting';
			connection.room.startsAt = null;
			connection.room.endsAt = null;
			connection.lane.ready = false;
			stopTicker(connection.room);
		}
		broadcastSnapshot(connection.room);
	}
}

/** @param {any} room */
function startWhenReady(room) {
	if (room.lanes.size !== 6) return;
	if (![...room.lanes.values()].every((lane) => lane.connected && lane.ready)) return;

	room.status = 'countdown';
	room.startsAt = Date.now() + countdownMilliseconds;
	room.endsAt = room.startsAt + durationSeconds * 1_000;
	room.ticker = setInterval(() => {
		const now = Date.now();
		if (room.status === 'countdown' && now >= room.startsAt) room.status = 'running';
		if (room.status === 'running' && now >= room.endsAt) finishRoom(room);
		else broadcastSnapshot(room);
	}, 250);
	room.ticker.unref();
}

/** @param {any} room */
function finishRoom(room) {
	if (room.status === 'finished') return;
	room.status = 'finished';
	stopTicker(room);
	broadcastSnapshot(room);
}

/** @param {any} room */
function stopTicker(room) {
	if (!room.ticker) return;
	clearInterval(room.ticker);
	room.ticker = null;
}

/** @param {number} matchNumber @returns {Assignment[]} */
function loadAssignments(matchNumber) {
	const databasePath = process.env.DATABASE_URL ?? 'data/typing-system.db';
	let database;
	try {
		database = new Database(databasePath, { readonly: true, fileMustExist: true });
		return /** @type {Assignment[]} */ (
			database
				.prepare(
					`select team_name as teamName,
				        representative_source as representativeSource,
				        lane_number as laneNumber
				 from match_assignments
				 where match_number = ?
				 order by lane_number`
				)
				.all(matchNumber)
		);
	} catch (error) {
		const code = /** @type {{ code?: string }} */ (error).code;
		if (code === 'SQLITE_CANTOPEN' || code === 'SQLITE_ERROR') return [];
		throw error;
	} finally {
		database?.close();
	}
}

/** @param {any} room */
function broadcastSnapshot(room) {
	const message = { type: 'competition.snapshot', data: createRoomSnapshot(room) };
	for (const monitor of room.monitors) send(monitor, message);
	for (const lane of room.lanes.values()) {
		if (lane.webSocket) send(lane.webSocket, message);
	}
}

/** @param {any} room @param {WebSocket} webSocket */
function sendSnapshot(room, webSocket) {
	send(webSocket, { type: 'competition.snapshot', data: createRoomSnapshot(room) });
}

/** @param {any} room */
function createRoomSnapshot(room) {
	const now = Date.now();
	const lanes = [...room.lanes.values()].map((lane) => createLaneSnapshot(room, lane, now));
	const ranked = [...lanes].sort(
		(left, right) =>
			right.score - left.score ||
			right.correctTypes - left.correctTypes ||
			left.incorrectTypes - right.incorrectTypes
	);
	const ranks = new Map(ranked.map((lane, index) => [lane.laneNumber, index + 1]));

	return {
		matchNumber: room.matchNumber,
		problemSetId: room.problemSetId,
		problemSetVersion: room.problemSetVersion,
		durationSeconds,
		status: room.status,
		serverTime: now,
		startsAt: room.startsAt,
		endsAt: room.endsAt,
		connectedCount: lanes.filter((lane) => lane.connected).length,
		readyCount: lanes.filter((lane) => lane.ready).length,
		lanes: lanes.map((lane) => ({
			...lane,
			rank:
				room.status === 'waiting' || room.status === 'countdown' ? null : ranks.get(lane.laneNumber)
		}))
	};
}

/** @param {any} room @param {any} lane @param {number} now */
function createLaneSnapshot(room, lane, now) {
	const view = getTypingView(lane.typingState);
	const elapsedSeconds =
		room.startsAt === null
			? 0
			: Math.max(0, Math.min(durationSeconds, (now - room.startsAt) / 1_000));
	const attempts = view.correctTypes + view.incorrectTypes;
	const accuracy = attempts === 0 ? 0 : view.correctTypes / attempts;
	const wpm = elapsedSeconds === 0 ? 0 : (view.correctTypes / elapsedSeconds) * 60;
	const score = calculateScore(view.correctTypes, view.incorrectTypes);
	const currentLength = Math.max(view.romanizedText.length, 1);
	const progress =
		((view.problemIndex + Math.min(1, view.inputPosition / currentLength)) / view.problemCount) *
		100;

	return {
		laneNumber: lane.laneNumber,
		teamName: lane.teamName,
		representativeSource: lane.representativeSource,
		connected: lane.connected,
		ready: lane.ready,
		status: laneStatus(room, lane),
		...view,
		accuracy,
		wpm,
		score,
		progress
	};
}

/** @param {number} correctTypes @param {number} incorrectTypes */
function calculateScore(correctTypes, incorrectTypes) {
	const attempts = correctTypes + incorrectTypes;
	if (attempts === 0) return 0;
	return Math.floor((60 * correctTypes ** 4) / (durationSeconds * attempts ** 3));
}

/** @param {any} room @param {any} lane */
function laneStatus(room, lane) {
	if (!lane.connected) return 'disconnected';
	if (room.status === 'waiting') return lane.ready ? 'ready' : 'connected';
	return room.status;
}

/** @param {WebSocket} webSocket @param {unknown} message */
function send(webSocket, message) {
	if (webSocket.readyState === WebSocket.OPEN) webSocket.send(JSON.stringify(message));
}
