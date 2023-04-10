<script>
import { onMount } from "svelte";
import { Button } from "sveltestrap";
import { debounce } from "debounce";
import { browser } from "$app/environment";
import Cursor from "$components/Cursor.svelte";
import Profile from "$components/Profile.svelte";
import { supabaseAnon } from "$lib/db.public";
import { Multiplayer, IGV } from "$lib/multiplayer";

export let channel;

// Screen state
let clicked; // If true, shows click animation at position clicked.x/y
let thisCursor;
let thisScreen;
let thisIGV;
let usersOnline = {};
let usersCursors = {};

// User State
let multiplayer = null;
let igv = null;

// On first load
onMount(async () => {
	if (!browser) return;

	// Initialize
	multiplayer = new Multiplayer({
		channel,
		screen: thisScreen,
		client: supabaseAnon,
		user: "User " + Math.round(Math.random() * 100),
		onUpdateUsers: (list) => (usersOnline = list),
		onUpdateCursors: (cursors) => (usersCursors = cursors),
		onClick: (c) => (clicked = c),
		onPayload: (payload) => {
			// Ignore messages to self
			console.log("Received", payload, multiplayer.me.id, payload.id === multiplayer.me.id ? "NO-OP" : "");
			if (payload.id === multiplayer.me.id) return;

			// Update IGV settings
			if (payload.type === "setting") {
				igv.set(payload.setting, payload.value);
			}

			// Process actions
			else if (payload.type === "action") {
				igv.process(payload.action, payload.value);
			}
		}
	});

	igv = new IGV({ multiplayer, div: thisIGV, genome: "hg38", tracks: [] });
	await igv.init();

	// Set cursor to be the current user's pointer
	thisScreen.style.cursor = `url('data:image/svg+xml;base64,${btoa(thisCursor.outerHTML)}'), pointer`;
});
</script>

<h4>Multiplayer IGV</h4>

<!-- Header bar -->
<div class="d-flex">
	<div class="me-auto">
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
	bind:this={thisScreen}
	on:pointermove={debounce((e) => multiplayer.broadcastPointerMove(e), 50)}
	on:pointerleave={(e) => multiplayer.broadcastPointerLeave(e)}
	on:click={(e) => multiplayer.broadcastClick(e)}
	on:keypress={() => {}}
>
	<!-- Show click events -->
	{#if clicked}
		{@const position = multiplayer.getCursorPositionReceive(clicked.x, clicked.y)}
		<div
			class="spinner-grow"
			style="z-index:9999; background-color: {Multiplayer.getHashColor(
				usersOnline[clicked?.id]?.name || 'Anonymous'
			)}; position:absolute; top: {position.y - 15}px; left: {position.x - 15}px"
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
		{@const position = multiplayer.getCursorPositionReceive(usersCursors[id].x, usersCursors[id].y)}
		<Cursor name={usersOnline[id]?.name || "Anonymous"} x={position.x} y={position.y} />
	{/if}
{/each}

<style>
.screen {
	border: 1px solid rgb(39, 113, 153);
	height: 70vh;
}
</style>
