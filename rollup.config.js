import html from "rollup-plugin-html";
import commonjs from "@rollup/plugin-commonjs";
import { terser } from "rollup-plugin-terser";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
	input: "src/igv.mjs",
	output: {
		format: "es",
		exports: "named",
		file: "dist/igv.mjs",
		// sourcemap: true
	},
	plugins: [
			html({ include: "**/*.html" }),
			commonjs(),
			nodeResolve({ browser: true }),
			terser()
		],
}
