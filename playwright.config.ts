import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);

export default defineConfig({
	use: { baseURL: `http://127.0.0.1:${port}` },
	webServer: {
		command: 'npm run build && npm run start',
		port,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
