import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { createCompetitionManager } from './competition.js';
import { parseClientMessage } from './protocol.js';

const attachedServers = new WeakMap();

/**
 * @param {import('node:http').Server} server
 */
export function attachRealtimeServer(server) {
	const existing = attachedServers.get(server);
	if (existing) return existing;

	const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
	const competitionManager = createCompetitionManager();
	attachedServers.set(server, webSocketServer);

	server.on('upgrade', (request, socket, head) => {
		let url;
		try {
			url = new URL(request.url ?? '/', 'http://localhost');
		} catch {
			socket.destroy();
			return;
		}
		if (url.pathname !== '/ws') {
			socket.destroy();
			return;
		}

		webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
			webSocketServer.emit('connection', webSocket, request);
		});
	});

	webSocketServer.on('connection', (webSocket) => {
		const connectionId = randomUUID();

		send(webSocket, {
			type: 'system.hello',
			data: { connectionId, serverTime: new Date().toISOString() }
		});

		webSocket.on('message', (data, isBinary) => {
			if (isBinary) {
				send(webSocket, { type: 'system.error', data: { code: 'binary_not_supported' } });
				return;
			}

			let decoded;
			try {
				decoded = JSON.parse(data.toString());
			} catch {
				send(webSocket, { type: 'system.error', data: { code: 'invalid_json' } });
				return;
			}

			const parsed = parseClientMessage(decoded);
			if (!parsed.success) {
				send(webSocket, { type: 'system.error', data: { code: 'invalid_message' } });
				return;
			}

			if (parsed.data.type === 'system.ping') {
				send(webSocket, {
					type: 'system.pong',
					data: { serverTime: new Date().toISOString() }
				});
				return;
			}

			competitionManager.handle(webSocket, parsed.data);
		});

		webSocket.on('close', () => competitionManager.disconnect(webSocket));
	});

	return webSocketServer;
}

/**
 * @param {WebSocket} webSocket
 * @param {unknown} message
 */
function send(webSocket, message) {
	if (webSocket.readyState === WebSocket.OPEN) webSocket.send(JSON.stringify(message));
}
