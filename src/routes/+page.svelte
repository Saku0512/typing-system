<script lang="ts">
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.tournamentName} | Typing System</title>
	<meta name="description" content={`${data.tournamentName}の競技タイピング運営画面`} />
</svelte:head>

<header class="app-header">
	<div>
		<p class="product-name">Typing System</p>
		<h1>{data.tournamentName}</h1>
	</div>
</header>

<main>
	<section aria-labelledby="participants-heading">
		<p class="eyebrow">TOURNAMENT</p>
		<h2 id="participants-heading">出場枠</h2>

		<div class="participant-table">
			<div class="participant-row participant-header" aria-hidden="true">
				<span>チーム</span>
				<span>出場クラス</span>
				<span>出場ID</span>
			</div>
			{#each data.teams as team (team.name)}
				<div class="participant-row">
					<strong>{team.name}</strong>
					<span>{team.representativeSources.join(' / ')}</span>
					<div class="participant-ids">
						{#each team.participantSlots as participant (participant.id)}
							<code>{participant.id}</code>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="empty-state" aria-labelledby="operation-heading">
		<p class="eyebrow">MATCHES</p>
		<h2 id="operation-heading">試合割り当て</h2>
		<p>各チームの出場順とレーンを設定してください。</p>
		<a class="button-link" href={resolve('/admin')}>試合を設定</a>
	</section>
</main>
