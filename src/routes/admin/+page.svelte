<script lang="ts">
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let currentAssignments = $derived(form?.assignments ?? data.assignments);

	function assignmentFor(matchNumber: number, teamName: string) {
		return currentAssignments.find(
			(assignment) => assignment.matchNumber === matchNumber && assignment.teamName === teamName
		);
	}
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
	<form method="POST">
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
							<label>
								<span class="visually-hidden">第{matchNumber}試合 {team.name} レーン</span>
								<select name={`lane_${matchNumber}_${teamIndex}`}>
									{#each [1, 2, 3, 4, 5, 6] as lane (lane)}
										<option value={lane} selected={assignment?.laneNumber === lane}>{lane}</option>
									{/each}
								</select>
							</label>
						</div>
					{/each}
				</div>
			</section>
		{/each}

		<div class="save-footer">
			<button class="primary-button" type="submit">保存</button>
		</div>
	</form>
</main>
