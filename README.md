# Multiplayer IGV

Work in progress.

## Development

### Pre-requisites

1. Supabase account with free tier (needed even for local dev unless you setup [their open source infra](https://github.com/supabase/realtime) yourself)
2. Cloudflare account (not needed for local dev)

### Supabase config

Create a `.env` file in the root folder that contains your Supabase database's **public** URL and anonymous key:

```
PUBLIC_SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co"
PUBLIC_SUPABASE_KEY_ANON = "YOUR_SUPABASE_ANON_KEY"
SUPABASE_KEY_ADMIN = "YOUR_SUPABASE_ADMIN_KEY"
```

You'll find that information in your Supabase dashboard under Settings --> API.

Make sure you use the **anonymous** key for `PUBLIC_SUPABASE_KEY_ANON` since it is exposed on the frontend, which is intended.

### Cloudflare config (skip for local dev)

    TODO

### Launch web server (local dev)

```bash
npm run dev
```
