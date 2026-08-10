<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { webSocketUrl, type CompetitionServerMessage } from '$lib/competition/types';
	import { onMount } from 'svelte';

	let { data, form } = $props();
	let currentAssignments = $derived(form?.assignments ?? data.assignments);

	function assignmentFor(matchNumber: number, teamName: string) {
		return currentAssignments.find(
			(assignment) => assignment.matchNumber === matchNumber && assignment.teamName === teamName
		);
	}

	function resultsFor(matchNumber: number) {
		return data.results.filter((result) => result.matchNumber === matchNumber);
	}

	function confirmationFor(matchNumber: number) {
		return data.confirmations.find((confirmation) => confirmation.matchNumber === matchNumber);
	}

	function confirmSubmission(event: SubmitEvent, matchNumber: number) {
		if (!window.confirm(`第${matchNumber}試合の結果を確定します。よろしいですか？`)) {
			event.preventDefault();
		}
	}

	onMount(() => {
		let stopped = false;
		let socket: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

		const connect = () => {
			socket = new WebSocket(webSocketUrl());
			socket.addEventListener('open', () => {
				socket?.send(JSON.stringify({ type: 'results.subscribe' }));
			});
			socket.addEventListener('message', (event) => {
				const message = JSON.parse(event.data) as CompetitionServerMessage;
				if (message.type === 'competition.finished' || message.type === 'competition.confirmed') {
					void invalidateAll();
				}
			});
			socket.addEventListener('close', () => {
				if (!stopped) reconnectTimer = setTimeout(connect, 1_000);
			});
		};

		connect();
		return () => {
			stopped = true;
			if (reconnectTimer) clearTimeout(reconnectTimer);
			socket?.close();
		};
	});
</script>

<svelte:head>
	<title>大会管理 | {data.tournamentName}</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<header class="app-header admin-header">
	<div>
		<p class="product-name">{data.tournamentName}</p>
		<h1>大会管理</h1>
	</div>
	<a class="header-link" href={resolve('/')}>大会概要</a>
</header>

<main class="admin-main">
	<form method="POST" action="?/saveAssignments">
		<div class="admin-toolbar">
			<div>
				<p class="eyebrow">MATCHES</p>
				<h2>試合割り当て</h2>
			</div>
			<button class="primary-button" type="submit">保存</button>
		</div>

		{#if form?.saved}
			<p class="form-notice is-success" role="status">保存しました。</p>
		{/if}

		{#if form?.issues}
			<div class="form-notice is-error" role="alert">
				{#each form.issues as issue (issue)}
					<p>{issue}</p>
				{/each}
			</div>
		{/if}

		{#each [1, 2, 3] as matchNumber (matchNumber)}
			<section class="match-editor" aria-labelledby={`match-${matchNumber}-heading`}>
				<h3 id={`match-${matchNumber}-heading`}>第{matchNumber}試合</h3>
				<div class="assignment-table">
					<div class="assignment-row assignment-header" aria-hidden="true">
						<span>チーム</span>
						<span>出場クラス</span>
						<span>レーン</span>
					</div>
					{#each data.teams as team, teamIndex (team.name)}
						{@const assignment = assignmentFor(matchNumber, team.name)}
						<div class="assignment-row">
							<strong>{team.name}</strong>
							<label>
								<span class="visually-hidden">第{matchNumber}試合 {team.name} 出場クラス</span>
								<select name={`source_${matchNumber}_${teamIndex}`}>
									{#each team.representativeSources as source (source)}
										<option value={source} selected={assignment?.representativeSource === source}>
											{source}
										</option>
									{/each}
								</select>
							</label>
							<span class="fixed-lane">{team.laneNumber}</span>
						</div>
					{/each}
				</div>
			</section>
		{/each}

		<div class="save-footer">
			<button class="primary-button" type="submit">保存</button>
		</div>
	</form>

	<section class="result-confirmation" aria-labelledby="result-confirmation-heading">
		<div class="admin-toolbar">
			<div>
				<p class="eyebrow">RESULTS</p>
				<h2 id="result-confirmation-heading">試合結果の確定</h2>
			</div>
		</div>

		{#if form?.confirmed}
			<p class="form-notice is-success" role="status">
				第{form.confirmedMatchNumber}試合の結果を確定しました。
			</p>
		{/if}
		{#if form?.confirmationIssue}
			<p class="form-notice is-error" role="alert">{form.confirmationIssue}</p>
		{/if}

		{#each [1, 2, 3] as matchNumber (matchNumber)}
			{@const results = resultsFor(matchNumber)}
			{@const confirmation = confirmationFor(matchNumber)}
			<section class="confirmation-match" aria-labelledby={`confirmation-${matchNumber}-heading`}>
				<div class="confirmation-heading">
					<div>
						<h3 id={`confirmation-${matchNumber}-heading`}>第{matchNumber}試合</h3>
						{#if confirmation}
							<small>
								{confirmation.confirmedBy} / {confirmation.confirmedAt.toLocaleString('ja-JP')}
							</small>
						{/if}
					</div>
					<span class:confirmed={Boolean(confirmation)}>
						{confirmation ? '確定' : results.length === 6 ? '未確定' : '結果待ち'}
					</span>
				</div>

				{#if results.length === 6}
					<div class="confirmation-table">
						<div class="confirmation-row confirmation-header" aria-hidden="true">
							<span>順位</span>
							<span>チーム</span>
							<span>出場クラス</span>
							<span>正タイプ</span>
							<span>ミス</span>
							<span>WPM</span>
							<span>正確率</span>
							<span>スコア</span>
						</div>
						{#each results as result (`${result.matchNumber}-${result.laneNumber}`)}
							<div class="confirmation-row">
								<strong>{result.rank}位</strong>
								<span>{result.teamName}</span>
								<code>{result.representativeSource}</code>
								<span>{result.correctTypes.toLocaleString()}</span>
								<span>{result.incorrectTypes.toLocaleString()}</span>
								<span>{result.wpm.toFixed(1)}</span>
								<span>{(result.accuracy * 100).toFixed(1)}%</span>
								<strong>{result.score.toLocaleString()}</strong>
							</div>
						{/each}
					</div>

					<form
						class="confirmation-actions"
						method="POST"
						action="?/confirmResults"
						onsubmit={(event) => confirmSubmission(event, matchNumber)}
					>
						<input type="hidden" name="matchNumber" value={matchNumber} />
						<button type="submit" disabled={Boolean(confirmation)}>
							{confirmation ? '確定済み' : '結果を確定'}
						</button>
					</form>
				{:else}
					<p class="confirmation-empty">競技終了後に6名分の結果が表示されます。</p>
				{/if}
			</section>
		{/each}
	</section>
</main>
