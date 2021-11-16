<script>
import { ulid } from "ulid";
import localforage from "localforage";
import { onMount } from "svelte";
import IGV from "./IGV.svelte";
import "bootstrap/dist/css/bootstrap.min.css";

let username = localStorage.getItem("user");  // localStorage is synchronous
let roomname = new URL(window.location).searchParams.get("room");
let disabled = false;
let rooms = [];
let usernameNew;

// Create a new room and redirect to it
async function createRoom() {
	disabled = true;
	const newRoomID = await fetch("/api/rooms", { method: "POST"}).then(d => d.text());

	const url = new URL(window.location);
	url.searchParams.set("room", newRoomID);
	window.location = String(url);
}

// Save user's name
async function saveUser(name) {
	if(!name)
		return;
	username = `${ulid()}:${name}`;
	localStorage.setItem("user", username);
}

// On load, add room to local history if not seen before
onMount(async () => {
	rooms = await localforage.getItem("rooms") || [];
	if(roomname != "" && roomname != null && !rooms.includes(roomname)) {
		await localforage.setItem("rooms", rooms.concat([ roomname ]));
	}
});
</script>

{#if roomname && username}
	<IGV {username} {roomname} />
{:else if !username}
	<div class="input-group mb-3">
		<span class="input-group-text" id="input-name">Your name:</span>
		<input type="text" class="form-control" aria-label="Username" aria-describedby="input-name" bind:value={usernameNew}>
	</div>

	<button class="btn btn-outline-success mt-4" on:click={() => saveUser(usernameNew)} {disabled}>Save</button>
{:else}
	<h5 class="mt-3">Recently viewed rooms</h5>
	{#if rooms.length == 0}
		<span class="text-muted">None</span><br />
	{:else}
		{#each rooms as room}
			<a href="?room={room}">{room}</a><br />
		{/each}
	{/if}

	<button class="btn btn-outline-success mt-4" on:click={createRoom} {disabled}>Create a new room</button>
{/if}
