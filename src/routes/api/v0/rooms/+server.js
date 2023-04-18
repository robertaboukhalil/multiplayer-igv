import { nanoid } from "nanoid";
import { supabaseAdmin } from "$lib/db.admin";
import { IGV_DEFAULTS } from "$lib/igv";

// Create new room
export async function POST({ request }) {
	const { genome } = await request.json();
	const uuid = nanoid(10);
	const config = {
		...IGV_DEFAULTS,
		genome: genome || "hg38"
	};

	const { data, error } = await supabaseAdmin.from("rooms_stg").insert({
		uuid,
		config,
		name: "Untitled Session"
	});

	return new Response(JSON.stringify(error ? { error } : { uuid }));
}
