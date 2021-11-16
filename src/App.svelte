<script>
import { ulid } from "ulid";
import IGV from "./IGV.svelte";

let username = `${ulid()}:robert`;
let roomname = new URL(window.location).searchParams.get("room");
</script>

{#if roomname}
	<IGV {username} {roomname} />
{:else}
	[ Create a new room ]
{/if}
