import { createClient } from "@supabase/supabase-js";
import { env as envPrivate } from "$env/dynamic/private";
import { env as envPublic } from "$env/dynamic/public";

export const supabaseAdmin = createClient(envPublic.PUBLIC_SUPABASE_URL, envPrivate.SUPABASE_KEY_ADMIN);
