<script>
import Multiplayer from "$components/Multiplayer.svelte";

export let data;
</script>

{#if data.channel && data.config}
	<Multiplayer channel={data.channel} config={data.config} />
{/if}
