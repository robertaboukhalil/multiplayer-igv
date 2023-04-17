<script>
import Multiplayer from "$components/Multiplayer.svelte";

export let data;
</script>

{#if data.channel}
	<Multiplayer channel={data.channel} config={data.config} />
{:else}
	Error: Could not find this session.
{/if}
