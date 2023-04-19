import { supabaseAdmin } from "$lib/db.admin";

// Update existing room (must know the UUID)
export async function POST({ params, request }) {
	const { name, config, regions } = await request.json();

	const response = await supabaseAdmin.from("rooms_stg").update({ name, config, regions }).eq("uuid", params.channel);
	return new Response(JSON.stringify(response));
}
