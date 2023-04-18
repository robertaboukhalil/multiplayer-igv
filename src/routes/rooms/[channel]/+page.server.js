import { supabaseAdmin } from "$lib/db.admin";

export async function load({ params }) {
	const { data, error } = await supabaseAdmin.from("rooms_stg").select("*").eq("uuid", params.channel).single();

	return {
		channel: params.channel,
		config: data.config,
		name: data.name
	};
}
