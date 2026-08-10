import { createServer } from 'node:http';
import { handler } from '../build/handler.js';
import { attachRealtimeServer } from './realtime.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);
const server = createServer(handler);
const webSocketServer = attachRealtimeServer(server);

server.listen(port, host, () => {
	console.log(`Typing System listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		webSocketServer.close();
		server.close(() => process.exit(0));
		setTimeout(() => process.exit(1), 30_000).unref();
	});
}
