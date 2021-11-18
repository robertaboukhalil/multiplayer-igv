<script>
import { ulid } from "ulid";
import { onMount } from "svelte";
import IGV from "./IGV.svelte";
import "bootstrap/dist/css/bootstrap.min.css";


// =============================================================================
// State
// =============================================================================

let roomID = new URL(window.location).searchParams.get("room");
let roomName = "My IGV View";  // Room name chosen by user
let userID = null;             // User ID, i.e. <uuid>:<user name>
let userName = "anonymous";    // Name chosen by user
let rooms = [];                // Recently seen rooms
let isBtnDisabled = false;     // Whether form buttons should be enabled


// =============================================================================
// Main logic
// =============================================================================

// Save user's name
async function saveUser() {
	userID = `${ulid()}:${userName || "anonymous"}`;
}

// Create a new room and redirect to it
async function createRoom() {
	isBtnDisabled = true;
	const newRoomID = await fetch("/api/rooms", {
		method: "POST",
		body: JSON.stringify({ roomName })
	}).then(d => d.text());

	const url = new URL(window.location);
	url.searchParams.set("room", newRoomID);
	window.location = String(url);
}

// On load
onMount(() => {
	// TODO:
	// rooms = ?
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
			<input type="text" class="form-control" bind:value={userName} autocomplete="off" autofocus>
		</div>
	</form>
	<button class="btn btn-outline-success mt-4" on:click={saveUser} disabled={isBtnDisabled}>Save</button>

<!-- Other show landing page -->
{:else}

	<h5 class="mt-3">Recently viewed rooms</h5>
	{#if rooms.length == 0}
		<span class="text-muted">None</span><br />
	{:else}
		{#each rooms as room}
			<a href="?room={room}">{room}</a><br />
		{/each}
	{/if}

	<h5 class="mt-5">Create a new room</h5>
	<form on:submit|preventDefault={saveUser}>
		<div class="input-group mb-3">
			<span class="input-group-text">Room name</span>
			<input type="text" class="form-control" bind:value={roomName}>
		</div>
		<div class="input-group mb-3">
			<span class="input-group-text">Your name:</span>
			<input type="text" class="form-control" bind:value={userName}>
		</div>
		<!-- <div class="input-group mb-3">
			<span class="input-group-text">Reference Genome</span>
			<select class="form-select" aria-label="Choose a reference genome" bind:value={genome}>
				<optgroup label="Genome">
					{#each Object.keys(GENOMES) as genomeID}
						<option value="{genomeID}">{GENOMES[genomeID].name}</option>
					{/each}
				</optgroup>
			</select>
		</div> -->
	</form>


	<button class="btn btn-outline-success mt-4" on:click={createRoom} disabled={isBtnDisabled}>Create</button>
{/if}
