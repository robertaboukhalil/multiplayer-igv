<script>
import { onMount } from "svelte";
import { Button, Spinner } from "sveltestrap";
import { debounce } from "debounce";
import { browser } from "$app/environment";
import Cursor from "$components/Cursor.svelte";
import Profile from "$components/Profile.svelte";
import { supabaseAnon } from "$lib/db.public";
import { Multiplayer } from "$lib/multiplayer";
import { IGV, IGV_DEFAULT_GENOME, IGV_GENOMES } from "$lib/igv";

export let channel;
export let config;

// Screen state
let clicked; // If true, shows click animation at position clicked.x/y
let thisCursor;
let thisScreen;
let thisIGV;
let usersOnline = {};
let usersCursors = {};
let loading = true;
let genome;

// User State
let multiplayer = null;
let igv = null;
let igvState = null;
let isTheSyncUser = false;

$: updateRefGenome(genome);

// On first load
onMount(async () => {
	if (!browser || !thisScreen) return;

	// Initialize Multiplayer logic
	multiplayer = new Multiplayer({
		channel,
		screen: thisScreen,
		client: supabaseAnon,
		user: "User " + Math.round(Math.random() * 100),
		onClick: (c) => (clicked = c),
		onUpdateCursors: (cursors) => (usersCursors = cursors),
		onUpdateUsers: (list) => {
			usersOnline = list;
			isTheSyncUser = multiplayer.me.id === Object.entries(usersOnline).sort((a, b) => a.time_joined - b.time_joined)?.[0]?.[0];
			console.log(isTheSyncUser ? "Now handling sync." : "Not handling sync");
		}
	});

	// Initialize IGV
	genome = config?.reference?.id || IGV_DEFAULT_GENOME;
	igv = new IGV({ multiplayer, config, div: thisIGV });
	await igv.init();

	// Set cursor to be the current user's pointer
	thisScreen.style.cursor = `url('data:image/svg+xml;base64,${btoa(thisCursor.outerHTML)}'), pointer`;

	// Background sync job
	syncIGVState();

	loading = false;
});

// Sync IGV state to database (only the user that's been there the longest runs this)
async function syncIGVState() {
	const newState = JSON.stringify({ config: igv.toJSON() });
	if (isTheSyncUser && newState && igvState !== newState) {
		await fetch(`/api/v0/rooms/${channel}`, { method: "POST", body: newState });
		igvState = newState;
	}

	setTimeout(syncIGVState, 500);
}

// Update ref genome
async function updateRefGenome() {
	if (loading || !genome) return;

	loading = true;
	await igv.set("genome", genome);
	loading = false;
}

// Handle pointer events
function handlePointerClick(e) {
	multiplayer.broadcastClick(e);
}

function handlePointerLeave(e) {
	multiplayer.broadcastPointerLeave(e);
}

function handlePointerMove(e) {
	multiplayer.broadcastPointerMove(e);
}

handlePointerMove = debounce(handlePointerMove, 5);
</script>

<h4>
	Test
	{#if loading}
		<Spinner size="sm" color="primary" />
	{/if}
</h4>

<!-- Header bar -->
<div class="d-flex">
	<!-- Choose genome -->
	<div class="pe-2">
		<div class="form-floating">
			<select class="form-select" id="provider" bind:value={genome} disabled={loading}>
				{#each Object.keys(IGV_GENOMES) as ref}
					<option value={ref}>{IGV_GENOMES[ref].name}</option>
				{/each}
			</select>
			<label for="provider">Reference Genome</label>
		</div>
	</div>

	<!-- Add tracks -->
	<div class="me-auto">
		<div class="mt-2">
			<Button
				color="primary"
				size="md"
				on:click={() => {
					const track = {
						url: "https://s3.amazonaws.com/igv.org.demo/GBM-TP.seg.gz",
						indexed: false,
						isLog: true,
						name: "GBM Copy # (TCGA Broad GDAC)"
					};
					igv.process("track-add", track);
					igv.broadcastAction("track-add", track);
					console.log("broadcast new track!");
				}}>Add track</Button
			>
		</div>
	</div>

	<!-- Who's online? -->
	<div class="text-end p-0 m-0">
		{#each Object.keys(usersOnline).sort() as id}
			{@const name = usersOnline[id]?.name || "Anonymous"}
			<Profile {name} isSelf={id === multiplayer.me.id} />
		{/each}
	</div>
</div>

<!-- Contents of synced view -->
<div
	class="screen"
	class:opacity-25={loading}
	bind:this={thisScreen}
	on:pointermove={handlePointerMove}
	on:pointerleave={handlePointerLeave}
	on:click={handlePointerClick}
	on:keypress={() => {}}
>
	<!-- Show click events -->
	{#if clicked}
		<div
			class="spinner-grow"
			style="z-index:9999; background-color: {Multiplayer.getHashColor(
				usersOnline[clicked?.id]?.name || 'Anonymous'
			)}; position:absolute; top: {clicked.y - 15}px; left: {clicked.x - 15}px"
		/>
	{/if}

	<!-- IGV -->
	<div bind:this={thisIGV} />
</div>

<!-- Current user's cursor -->
<svg
	bind:this={thisCursor}
	style="display:none"
	width="24"
	height="36"
	viewBox="0 0 24 36"
	fill={Multiplayer.getHashColor(multiplayer?.me?.name || "Anonymous")}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M 8.553 13.433 L 11.511 19.256 L 9.083 20.717 L 6.176 14.382 L 2.433 17.229 L 2.433 1.544 L 12.79 12.907 L 8.553 13.433 Z" />
</svg>

<!-- Everyone else's cursors -->
{#each Object.keys(usersCursors) as id}
	{#if id !== multiplayer.me.id}
		<Cursor name={usersOnline[id]?.name || "Anonymous"} x={usersCursors[id].x} y={usersCursors[id].y} />
	{/if}
{/each}

<style>
.screen {
	height: 70vh;
}
</style>
