<script>
import { ulid } from "ulid";
import localforage from "localforage";
import { onMount } from "svelte";
import IGV from "./IGV.svelte";
import "bootstrap/dist/css/bootstrap.min.css";

let username = `${ulid()}:robert`;
let roomname = new URL(window.location).searchParams.get("room");
let disabled = false;
let rooms = [];

// Create a new room and redirect to it
async function createRoom() {
	disabled = true;
	const newRoomID = await fetch("/api/rooms", { method: "POST"}).then(d => d.text());
	window.location = `?room=${newRoomID}`;
}

// On load
onMount(async () => {
	// Add room to local history if not seen before
	rooms = await localforage.getItem("rooms") || [];
	if(roomname != "" && roomname != null && !rooms.includes(roomname)) {
		await localforage.setItem("rooms", rooms.concat([ roomname ]));
	}
})
</script>

{#if roomname}
	<IGV {username} {roomname} />
{:else}
	<h5 class="mt-3">Recently viewed rooms</h5>
	{#if rooms.length == 0}
		<span class="text-muted">None</span>
	{:else}
		{#each rooms as room}
			<a href="?room={room}">{room}</a><br />
		{/each}
	{/if}

	<button class="btn btn-outline-success mt-4" on:click={createRoom} {disabled}>Create a new room</button>
{/if}
