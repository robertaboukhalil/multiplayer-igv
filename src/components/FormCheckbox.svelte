<script>
export let label;
export let checked;
</script>

<div class="input-group input-group-sm mt-2">
	<span class="input-group-text">{label}</span>
	<div class="input-group-text bg-white">
		<input type="checkbox" class="form-check-input" bind:checked={checked}>
	</div>
</div>
