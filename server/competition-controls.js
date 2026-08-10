const controllerKey = Symbol.for('typing-system.competition-controller');

/** @param {{ start: (matchNumber: number) => CompetitionStartResult }} controller */
export function registerCompetitionController(controller) {
	Reflect.set(globalThis, controllerKey, controller);
}

/** @param {number} matchNumber @returns {CompetitionStartResult} */
export function requestCompetitionStart(matchNumber) {
	const controller = Reflect.get(globalThis, controllerKey);
	if (!controller || typeof controller.start !== 'function') {
		return { started: false, reason: 'controller_unavailable' };
	}
	return controller.start(matchNumber);
}

/**
 * @typedef {
 *   | { started: true }
 *   | { started: false, reason: 'controller_unavailable' | 'room_not_initialized' | 'assignments_incomplete' | 'not_ready' | 'invalid_status', status?: string, connectedCount?: number, readyCount?: number }
 * } CompetitionStartResult
 */
