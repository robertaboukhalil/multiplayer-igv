import { nanoid } from "nanoid";
import { supabaseAdmin } from "$lib/db.admin";
import { IGV_DEFAULTS, IGV_DEFAULT_GENOME } from "$lib/igv";

// Create new room
export async function POST({ request }) {
	const payload = await request.json();
	const genome = payload.genome || IGV_DEFAULT_GENOME;
	const uuid = nanoid(10);
	const config = {
		...IGV_DEFAULTS,
		genome
	};

	const { data, error } = await supabaseAdmin.from("rooms_stg").insert({
		uuid,
		config,
		name: "Untitled Session"
	});

	return new Response(JSON.stringify(error ? { error } : { uuid }));
}
