import { supabaseAdmin } from "$lib/db.admin";

export async function load({ params }) {
	const { data, error } = await supabaseAdmin.from("rooms_stg").select("uuid, name, config, regions").eq("uuid", params.channel).single();

	if (error) return;
	return data;
}
