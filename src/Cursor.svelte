<script>
import hash from "string-hash";
import { schemeCategory10 } from "d3-scale-chromatic";

export let name = "anonymous";
export let hidden = false;
export let x = 0;
export let y = 0;

// Generate a color from a user ID
function getColor(user) {
	return schemeCategory10[Math.abs(hash(user)) % schemeCategory10.length];
}
</script>

<svg
	id="cursor"
	style="left: {x}; top: {y}"
	width="24"
	height="36"
	viewBox="0 0 24 36"
	fill={hidden ? "transparent" : getColor(name)}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M 8.553 13.433 L 11.511 19.256 L 9.083 20.717 L 6.176 14.382 L 2.433 17.229 L 2.433 1.544 L 12.79 12.907 L 8.553 13.433 Z"/>
</svg>

<style>
/* Source: https://github.com/liveblocks/liveblocks/blob/main/examples/javascript-live-cursors/static/index.html */
#cursor {
	position: absolute;
	left: 0;
	top: 0;
	transition: transform 0.3s cubic-bezier(0.17, 0.93, 0.38, 1);
}
</style>
