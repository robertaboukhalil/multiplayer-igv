import copy from "rollup-plugin-copy";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import nodeResolve from "@rollup/plugin-node-resolve";

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
			nodeResolve({ browser: true }),
			terser()
		]
	},
	// App (front-end)
	{
		input: "src/app.mjs",
		output: {
			file: "dist/app.mjs"
		},
		// Copy over static assets
		plugins: [
			copy({ targets: [{ src: "src/index.html", dest: "dist/" }] })
		]
	}
];
