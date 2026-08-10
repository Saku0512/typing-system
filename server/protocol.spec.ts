import { describe, expect, it } from 'vitest';
import { parseClientMessage } from './protocol.js';

describe('realtime protocol', () => {
	it('accepts a heartbeat', () => {
		expect(parseClientMessage({ type: 'system.ping' }).success).toBe(true);
	});

	it.each([null, {}, { type: 'system.ping', extra: true }, { type: 'typing.input' }])(
		'rejects an unsupported payload: %j',
		(payload) => {
			expect(parseClientMessage(payload).success).toBe(false);
		}
	);
});
