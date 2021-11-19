<script>
import { ulid } from "ulid";
import { onMount } from "svelte";
import localforage from "localforage";
import IGV from "./components/IGV.svelte";
import "bootstrap/dist/css/bootstrap.min.css";


// =============================================================================
// State
// =============================================================================

let roomID = new URL(window.location).searchParams.get("room");
let roomName = "";          // Room name chosen by user
let rooms = [];             // Recently seen rooms
let userID = null;          // User ID, i.e. <uuid>:<user name>
let userName = "";          // Name chosen by user
let isBtnDisabled = false;  // Whether form buttons should be enabled


// =============================================================================
// Main logic
// =============================================================================

// Save user's name
async function saveUser() {
	const newName = `${ulid()}:${userName || "anonymous"}`;
	if(newName.length > 64)
		alert("Name too long");
	else
		userID = newName;
}

// Create new room
async function createRoom() {
	isBtnDisabled = true;
	roomID = await fetch("/api/rooms", {
		method: "POST",
		body: JSON.stringify({ roomName })
	}).then(d => d.text());
	saveUser();

	window.history.pushState({}, null, `?room=${roomID}`);
}

// On load
onMount(async () => {
	rooms = await localforage.getItem("rooms") || [];
});


// =============================================================================
// UI
// =============================================================================
</script>

<!-- Room and user ID defined => show the room -->
{#if roomID && userID}

	<IGV {roomID} {userID} />

<!-- Have room ID but missing user ID => ask user for their name -->
{:else if roomID && !userID}

	<form on:submit|preventDefault={saveUser}>
		<div class="input-group mb-3">
			<span class="input-group-text">Your name:</span>
			<!-- svelte-ignore a11y-autofocus -->
			<input type="text" class="form-control" bind:value={userName} placeholder="Enter your name" autocomplete="off" autofocus>
		</div>
	</form>
	<button class="btn btn-outline-success mt-4" on:click={saveUser} disabled={isBtnDisabled}>Save{#if isBtnDisabled} ⌛{/if}</button>

<!-- Other show landing page -->
{:else}

	<h5 class="mt-3">Recently viewed rooms</h5>
	{#if rooms.length == 0}
		<span class="text-muted">None</span><br />
	{:else}
		{#each rooms as room}
			<a href="?room={room.id}">{room.name}</a><br />
		{/each}
		<button class="btn btn-sm btn-outline-secondary mt-3" on:click={async () => {
			rooms = [];
			await localforage.setItem("rooms", []);
		}}>Clear</button>
	{/if}

	<h5 class="mt-5">Create a new room</h5>
	<form on:submit|preventDefault={createRoom}>
		<div class="input-group mb-3">
			<span class="input-group-text">Room name:</span>
			<!-- svelte-ignore a11y-autofocus -->
			<input type="text" class="form-control" placeholder="Enter a room name" bind:value={roomName} autofocus>
		</div>
		<div class="input-group mb-3">
			<span class="input-group-text">Your name:</span>
			<input type="text" class="form-control" placeholder="Enter your name" bind:value={userName}>
		</div>
	</form>
	<button class="btn btn-outline-success mt-4" on:click={createRoom} disabled={isBtnDisabled}>Create{#if isBtnDisabled} ⌛{/if}</button>
{/if}
