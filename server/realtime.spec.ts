import { createServer, type IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import { attachRealtimeServer } from './realtime.js';

describe('realtime server upgrades', () => {
	it('destroys upgrade sockets for paths other than /ws', () => {
		const server = createServer();
		attachRealtimeServer(server);
		const destroy = vi.fn();

		server.emit(
			'upgrade',
			{ url: '/not-websocket' } as IncomingMessage,
			{ destroy } as unknown as Socket,
			Buffer.alloc(0)
		);

		expect(destroy).toHaveBeenCalledOnce();
	});

	it('destroys malformed upgrade URLs without throwing', () => {
		const server = createServer();
		attachRealtimeServer(server);
		const destroy = vi.fn();

		expect(() =>
			server.emit(
				'upgrade',
				{ url: '//[' } as IncomingMessage,
				{ destroy } as unknown as Socket,
				Buffer.alloc(0)
			)
		).not.toThrow();
		expect(destroy).toHaveBeenCalledOnce();
	});
});
