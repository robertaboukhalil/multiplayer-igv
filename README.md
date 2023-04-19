# Multiplayer IGV

Adds real-time collaboration to an IGV.js view, with share links and saved annotations.

## Demo

Test it out at https://igv.sandbox.bio/.

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

In your Cloudflare account's dashboard, set up Cloudflare Pages. In the form:

1. Connect your fork of this repo so that it gets deployed every time you push to `main`
2. For build settings, choose the Svelte Kit preset
3. For environment variables, set:
```
NODE_VERSION=16
PUBLIC_SUPABASE_URL = "https://YOUR_SUPABASE_PROJECT_ID.supabase.co"
PUBLIC_SUPABASE_KEY_ANON = "YOUR_SUPABASE_ANON_KEY"
SUPABASE_KEY_ADMIN = "YOUR_SUPABASE_ADMIN_KEY" # Make sure to click the encrypt icon for this one
```

### Launch web server (local dev)

```bash
npm run dev
```
