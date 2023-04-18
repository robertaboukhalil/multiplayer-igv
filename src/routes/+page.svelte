<script>
import { goto } from "$app/navigation";
import { IGV_GENOMES } from "$lib/igv";
import { Alert, Button } from "sveltestrap";

let error = "";
let genome = "hg38";
let loading = false;

async function createSession() {
	loading = true;

	try {
		const response = await fetch("/api/v0/rooms", {
			method: "POST",
			body: JSON.stringify({ genome })
		}).then((d) => d.json());

		if (response.error) {
			throw "Could not create room. Please try again.";
		}
		goto(`/rooms/${response.uuid}`);
	} catch (err) {
		error = err;
		loading = false;
	}
}
</script>

Real-time collaboration built on top of IGV.js. Get started below. No login required.

{#if error}
	<Alert color="danger">
		{error}
	</Alert>
{/if}

<div class="card mt-4 col-4">
	<div class="card-body">
		<h5 class="card-title">Create new IGV session</h5>
		<div class="py-3">
			<div class="form-floating">
				<select class="form-select" id="provider" bind:value={genome}>
					{#each Object.keys(IGV_GENOMES) as ref}
						<option value={ref}>{IGV_GENOMES[ref].name}</option>
					{/each}
				</select>
				<label for="provider">Reference Genome</label>
			</div>
		</div>
		<Button color="primary" on:click={createSession} disabled={loading}>Create session!</Button>
	</div>
</div>
