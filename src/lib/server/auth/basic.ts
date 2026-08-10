import { timingSafeEqual } from 'node:crypto';

export type BasicCredentials = {
	username: string;
	password: string;
};

export function verifyBasicAuthorization(
	authorization: string | null,
	expected: BasicCredentials
): boolean {
	if (!authorization?.startsWith('Basic ')) return false;

	let decoded: string;
	try {
		decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
	} catch {
		return false;
	}

	const separator = decoded.indexOf(':');
	if (separator < 0) return false;

	return (
		safeEqual(decoded.slice(0, separator), expected.username) &&
		safeEqual(decoded.slice(separator + 1), expected.password)
	);
}

function safeEqual(actual: string, expected: string): boolean {
	const actualBuffer = Buffer.from(actual);
	const expectedBuffer = Buffer.from(expected);
	return (
		actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
	);
}
