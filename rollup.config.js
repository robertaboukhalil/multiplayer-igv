import copy from "rollup-plugin-copy";
import css from "rollup-plugin-css-only";
import svelte from "rollup-plugin-svelte";
import { terser } from "rollup-plugin-terser";
import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default [
	// API (back-end)
	{
		input: "src/api.mjs",
		output: {
			format: "es",
			exports: "named",
			file: "dist/api.mjs",
			// sourcemap: true
		},
		plugins: [
			commonjs(),
			resolve({ browser: true }),
			terser()
		]
	},
	// App (front-end)
	{
		input: "src/app.js",
		output: {
			file: "dist/app.js",
			format: "iife",
			name: "app"
		},
		// Copy over static assets
		plugins: [
			svelte(),
			css({ output: "app.css" }),
			copy({ targets: [{ src: "src/index.html", dest: "dist/" }] }),
			commonjs(),
			resolve({ browser: true }),
			terser()
		]
	}
];
