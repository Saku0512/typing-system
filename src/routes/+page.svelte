<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let realtimeState = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let realtimeServerTime = $state<string>();
	let serverTime = $derived(realtimeServerTime ?? data.serverTime);

	onMount(() => {
		let retryTimer: ReturnType<typeof setTimeout> | undefined;
		let socket: WebSocket | undefined;
		let disposed = false;

		const connect = () => {
			realtimeState = 'connecting';
			const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
			socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

			socket.addEventListener('open', () => {
				realtimeState = 'connected';
				socket?.send(JSON.stringify({ type: 'system.ping' }));
			});

			socket.addEventListener('message', (event) => {
				const message = JSON.parse(String(event.data));
				if (message.type === 'system.hello' || message.type === 'system.pong') {
					realtimeServerTime = message.data.serverTime;
				}
			});

			socket.addEventListener('close', () => {
				realtimeState = 'disconnected';
				if (!disposed) retryTimer = setTimeout(connect, 1500);
			});
		};

		connect();

		return () => {
			disposed = true;
			if (retryTimer) clearTimeout(retryTimer);
			socket?.close();
		};
	});
</script>

<svelte:head>
	<title>大会運営 | Typing System</title>
	<meta name="description" content="タイピング競技運営システム" />
</svelte:head>

<header class="app-header">
	<div>
		<p class="product-name">Typing System</p>
		<h1>大会運営</h1>
	</div>
	<span class="environment">LOCAL</span>
</header>

<main>
	<section aria-labelledby="system-status">
		<div class="section-heading">
			<div>
				<p class="eyebrow">SYSTEM</p>
				<h2 id="system-status">システム状態</h2>
			</div>
			<time datetime={serverTime}>{new Date(serverTime).toLocaleString('ja-JP')}</time>
		</div>

		<div class="status-table">
			<div class="status-row">
				<span class="status-dot is-online" aria-hidden="true"></span>
				<strong>アプリケーション</strong>
				<span>稼働中</span>
			</div>
			<div class="status-row">
				<span class="status-dot" class:is-online={data.databaseConnected}></span>
				<strong>データベース</strong>
				<span>{data.databaseConnected ? '接続済み' : '接続エラー'}</span>
			</div>
			<div class="status-row">
				<span class="status-dot" class:is-online={realtimeState === 'connected'}></span>
				<strong>リアルタイム通信</strong>
				<span
					>{realtimeState === 'connected'
						? '接続済み'
						: realtimeState === 'connecting'
							? '接続中'
							: '再接続中'}</span
				>
			</div>
		</div>
	</section>

	<section class="empty-state" aria-labelledby="tournament-heading">
		<p class="eyebrow">TOURNAMENT</p>
		<h2 id="tournament-heading">大会未設定</h2>
		<p>大会データの登録後、試合状況がここに表示されます。</p>
		<button type="button" disabled>大会を作成</button>
	</section>
</main>
