import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		// Avoids "Styles is not a valid SSR component" error
		include: ["sveltestrap"]
	},
	ssr: {
		// Avoids "cannot use import statement outside a module" error
		noExternal: ["@popperjs/core"]
	}
});
