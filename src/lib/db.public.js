import { env } from "$env/dynamic/public";
import { createClient } from "@supabase/supabase-js";

// Publicly-accessible token
export const supabaseAnon = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_KEY_ANON, {
	realtime: {
		params: {
			eventsPerSecond: -1
		}
	}
});
