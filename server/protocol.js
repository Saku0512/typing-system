import { z } from 'zod';

export const clientMessageSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('system.ping') }).strict()
]);

/**
 * @param {unknown} value
 */
export function parseClientMessage(value) {
	return clientMessageSchema.safeParse(value);
}
