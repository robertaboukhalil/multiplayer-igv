import adapter from "@sveltejs/adapter-cloudflare";

const config = {
	kit: {
		adapter: adapter(),
		alias: {
			"$components/*": "./src/components/*",
			"$lib/*": "./src/lib/*",
			"$routes/*": "./src/routes/*"
		}
	}
};

export default config;
