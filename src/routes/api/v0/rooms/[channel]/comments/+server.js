import { supabaseAdmin } from "$lib/db.admin";

// // List comments
// export async function GET({ params }) {
// 	const { data, error } = await supabaseAdmin
// 		.from("rooms_stg")
// 		.select("channel:uuid, comments:comments_stg (comment, location, time_created)")
// 		.eq("uuid", params.channel)
// 		.single();

// 	return new Response(JSON.stringify(error ? { error: "Not found" } : data));
// }

// Create/update comment
export async function POST({ request }) {
	const { room_id, comment, location } = await request.json();
	const { data, error } = await supabaseAdmin.from("comments_stg").upsert({
		room_id,
		comment,
		location
	});

	return new Response(JSON.stringify(error ? { error } : {}));
}
