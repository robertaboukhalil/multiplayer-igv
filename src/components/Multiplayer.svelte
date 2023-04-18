<script>
import { onMount } from "svelte";
import { Button, Icon, Input, Modal, ModalBody, ModalFooter, ModalHeader, Spinner } from "sveltestrap";
import { debounce } from "debounce";
import { generateUsername } from "unique-username-generator";
import { browser } from "$app/environment";
import Cursor from "$components/Cursor.svelte";
import Profile from "$components/Profile.svelte";
import { supabaseAnon } from "$lib/db.public";
import { Multiplayer } from "$lib/multiplayer";
import { IGV } from "$lib/igv";

export let channel;
export let config;
export let name;

// Screen state
let clicked; // If true, shows click animation at position clicked.x/y
let thisCursor;
let thisScreen;
let thisIGV;
let usersOnline = {};
let usersCursors = {};
let loading = true;
let toggleRenameRoom = () => (isOpenRenameRoom = !isOpenRenameRoom);
let isOpenRenameRoom;
let nameNew = name;

// User State
let multiplayer = null;
let igv = null;
let igvState = null;
let isTheSyncUser = false;

// On first load
onMount(async () => {
	if (!browser || !thisScreen) return;

	// Initialize Multiplayer logic
	multiplayer = new Multiplayer({
		channel,
		screen: thisScreen,
		client: supabaseAnon,
		user: generateUsername(" "),
		onClick: (c) => (clicked = c),
		onUpdateCursors: (cursors) => (usersCursors = cursors),
		onUpdateUsers: (list) => {
			usersOnline = list;
			isTheSyncUser = multiplayer.me.id === Object.entries(usersOnline).sort((a, b) => a.time_joined - b.time_joined)?.[0]?.[0];
			console.log(isTheSyncUser ? "Now handling sync." : "Not handling sync");
		}
	});

	// Initialize IGV
	igv = new IGV({
		config,
		multiplayer,
		div: thisIGV,
		onAppPayload: (payload) => {
			if (payload.setting === "name") {
				name = payload.value;
			}
		}
	});
	await igv.init();

	// Set cursor to be the current user's pointer
	thisScreen.style.cursor = `url('data:image/svg+xml;base64,${btoa(thisCursor.outerHTML)}'), pointer`;

	// Background sync job
	syncIGVState();

	loading = false;
});

// Sync IGV state to database (only the user that's been there the longest runs this)
async function syncIGVState() {
	const newState = JSON.stringify({
		name,
		config: igv.toJSON()
	});
	if (!loading && isTheSyncUser && newState && igvState !== newState) {
		await fetch(`/api/v0/rooms/${channel}`, { method: "POST", body: newState });
		igvState = newState;
	}

	setTimeout(syncIGVState, 500);
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
	{name || "Untitled Session"}

	<!-- Rename session -->
	<small class="text-secondary small">
		<Button on:click={toggleRenameRoom} size="sm" color="outline-primary" disabled={loading}>
			<Icon name="pencil" /> Rename
		</Button>
	</small>

	<!-- Share link -->
	<small class="text-secondary small">
		<Button on:click={() => navigator.clipboard.writeText(window.location.toString())} size="sm" color="outline-primary" disabled={loading}>
			<Icon name="clipboard" /> Copy URL
		</Button>
	</small>

	{#if loading}
		<Spinner size="sm" color="primary" />
	{/if}
</h4>

<Modal isOpen={isOpenRenameRoom} toggle={toggleRenameRoom}>
	<ModalHeader toggle={toggleRenameRoom}>Rename Session</ModalHeader>
	<ModalBody>
		<Input type="text" bind:value={nameNew} />
	</ModalBody>
	<ModalFooter>
		<Button
			color="primary"
			on:click={() => {
				name = nameNew;
				toggleRenameRoom();
				multiplayer.broadcast("app", {
					setting: "name",
					value: nameNew
				});
			}}>Save</Button
		>
		<Button color="secondary" on:click={toggleRenameRoom}>Cancel</Button>
	</ModalFooter>
</Modal>

<!-- Header bar -->
<div class="d-flex">
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
					igv.set("tracks", track);
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
