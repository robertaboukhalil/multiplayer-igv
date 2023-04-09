<script>
import { onMount } from "svelte";
import { browser } from "$app/environment";
import Cursor from "$components/Cursor.svelte";
import Profile from "$components/Profile.svelte";
import { supabaseAnon } from "$lib/db.public";
import { Multiplayer, IGV } from "$lib/multiplayer";

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
	igv = await new IGV();
	multiplayer = new Multiplayer({
		screen: thisScreen,
		client: supabaseAnon,
		channel: "test",
		user: "User " + Math.round(Math.random() * 10),
		onUpdateUsers: (list) => (usersOnline = list),
		onUpdateCursors: (cursors) => (usersCursors = cursors),
		onClick: (c) => (clicked = c),
		onPayload: (payload) => {
			// Ignore messages to self
			if (payload.id === multiplayer.me.id) {
				console.log("Ignoring message to self", payload, multiplayer.me.id)
				return;
			}

			// Interpret messages
			console.log("Received", payload, multiplayer.me.id);
			igv.set(payload.type, payload[payload.type]);
		}
	});

	igv.init({
		div: thisIGV,
		genome: "hg38",
		tracks: [],
		onEvent: (payload) => {
			console.log("Broadcasting:", payload, "from", multiplayer.me.id);
			multiplayer.broadcast("app", payload);
		}
	});

	// Set cursor to be the current user's pointer
	thisScreen.style.cursor = `url('data:image/svg+xml;base64,${btoa(thisCursor.outerHTML)}'), pointer`;
});
</script>

<h4>Multiplayer IGV</h4>

<!-- Who's online? -->
<div class=" text-end p-0 m-0">
	{#each Object.keys(usersOnline).sort() as id}
		{@const name = usersOnline[id]?.name || "Anonymous"}
		<Profile {name} isSelf={id === multiplayer.me.id} />
	{/each}
</div>

<!-- Contents of synced view -->
<div
	class="screen"
	bind:this={thisScreen}
	on:pointermove={(e) => multiplayer.broadcastPointerMove(e)}
	on:pointerleave={(e) => multiplayer.broadcastPointerLeave(e)}
	on:click={(e) => multiplayer.broadcastClick(e)}
	on:keypress={() => {}}
>
	<!-- Show click events -->
	{#if clicked}
		{@const position = multiplayer.getCursorPositionReceive(clicked.x, clicked.y)}
		<div
			class="spinner-grow"
			style="background-color: {Multiplayer.getHashColor(usersOnline[clicked?.id]?.name || 'Anonymous')}; position:absolute; top: {position.y -
				15}px; left: {position.x - 15}px"
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
