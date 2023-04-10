import { supabaseAdmin } from "$lib/db.admin";

// Update existing room (must know the UUID)
export async function POST({ params, request }) {
	const { config } = await request.json();

	const response = await supabaseAdmin.from("rooms_stg").update({ config }).eq("uuid", params.channel);
	return new Response(JSON.stringify(response));
}
