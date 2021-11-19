<script>
export let label;
export let selected;
export let labelOpt = "Choose an option";
export let values = [];
export let fnDesc = value => value;
</script>

<div class="input-group input-group-sm mt-2">
	<span class="input-group-text">{label}</span>
	<select class="form-select" bind:value={selected}>
		<optgroup label={labelOpt}>
			{#each values as value}
				<option value="{value}">{fnDesc(value)}</option>
			{/each}
		</optgroup>
	</select>
</div>
