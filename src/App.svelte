<script>
import { ulid } from "ulid";
import IGV from "./IGV.svelte";
import "bootstrap/dist/css/bootstrap.min.css";

let username = `${ulid()}:robert`;
let roomname = new URL(window.location).searchParams.get("room");
</script>

{#if roomname}
	<IGV {username} {roomname} />
{:else}
	[ Create a new room ]
{/if}
