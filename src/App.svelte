<script>
import { ulid } from "ulid";
import IGV from "./IGV.svelte";
import "bootstrap/dist/css/bootstrap.min.css";

let username = `${ulid()}:robert`;
let roomname = new URL(window.location).searchParams.get("room");
let disabled = false;

// Create a new room and redirect to it
async function createRoom() {
	disabled = true;
	const newRoomID = await fetch("/api/rooms", { method: "POST"}).then(d => d.text());
	window.location = `?room=${newRoomID}`;
}
</script>

{#if roomname}
	<IGV {username} {roomname} />
{:else}
	<button on:click={createRoom} {disabled}>Create a new room</button>
{/if}
