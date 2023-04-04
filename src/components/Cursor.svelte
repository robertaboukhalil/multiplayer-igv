<script>
import { Multiplayer } from "$lib/multiplayer";

export let name = "anonymous";
export let hidden = false;
export let x = 0;
export let y = 0;
</script>

<svg
	class="cursor"
	style="left: {x}; top: {y}"
	width="200"
	height="36"
	viewBox="0 0 200 36"
	fill={hidden ? "transparent" : Multiplayer.getHashColor(name)}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M 8.553 13.433 L 11.511 19.256 L 9.083 20.717 L 6.176 14.382 L 2.433 17.229 L 2.433 1.544 L 12.79 12.907 L 8.553 13.433 Z" />
	<text fill={Multiplayer.getHashColor(name)} x="15" y="20" font-family="Helvetica, Arial, sans-serif" font-size="smaller">{name}</text>
</svg>

<style>
/* Source: https://github.com/liveblocks/liveblocks/blob/main/examples/javascript-live-cursors/static/index.html */
.cursor {
	position: absolute;
	left: 0;
	top: 0;
	z-index: 999;
	transition: transform 0.3s cubic-bezier(0.17, 0.93, 0.38, 1);
}
</style>
