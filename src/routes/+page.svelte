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

	<section aria-labelledby="operation-heading">
		<p class="eyebrow">MATCHES</p>
		<h2 id="operation-heading">試合・レーン情報</h2>

		{#if data.assignments.length > 0}
			<div class="match-schedule">
				{#each [1, 2, 3] as matchNumber (matchNumber)}
					<section class="scheduled-match" aria-labelledby={`public-match-${matchNumber}-heading`}>
						<h3 id={`public-match-${matchNumber}-heading`}>第{matchNumber}試合</h3>
						<div class="lane-table">
							<div class="lane-row lane-header" aria-hidden="true">
								<span>レーン</span>
								<span>チーム</span>
								<span>出場クラス</span>
							</div>
							{#each data.assignments.filter((assignment) => assignment.matchNumber === matchNumber) as assignment (`${assignment.matchNumber}-${assignment.teamName}`)}
								<div class="lane-row">
									<strong class="lane-number">{assignment.laneNumber}</strong>
									<span>{assignment.teamName}</span>
									<code>{assignment.representativeSource}</code>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
			<div class="schedule-actions">
				<a class="button-link" href={resolve('/admin')}>設定を変更</a>
			</div>
		{:else}
			<div class="empty-state">
				<p>各チームの出場順を設定すると、ここにレーン情報が表示されます。</p>
				<a class="button-link" href={resolve('/admin')}>試合を設定</a>
			</div>
		{/if}
	</section>
</main>
