<script>
import Multiplayer from "$components/Multiplayer.svelte";

export let data;
</script>

{#if data.uuid}
	<Multiplayer channel={data.uuid} config={data.config} name={data.name} regions={data.regions} />
{:else}
	Error: Could not find this session.
{/if}
