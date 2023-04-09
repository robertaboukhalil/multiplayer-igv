<script>
import { Tooltip } from "sveltestrap";
import { Multiplayer } from "$lib/multiplayer";

export let name;
export let isSelf = false;

// State
let thisCircle;
$: initials = getInitials(name);
$: color = Multiplayer.getHashColor(name);

function getInitials(str = "") {
	const initials = str
		.toUpperCase()
		.split(" ")
		.map((str) => str[0]);

	if (initials.length === 1) return initials[0];
	return `${initials[0]}${initials[initials.length - 1]}`;
}
</script>

<div class="circle" style="background-color: {color}" class:border-me={isSelf}>
	<p bind:this={thisCircle} class="circle-inner">{initials}</p>
</div>

<Tooltip text={name} target={thisCircle}>
	{name}
	{#if isSelf}
		(me)
	{/if}
</Tooltip>

<style>
/* Source: https://codepen.io/rtd62/pen/ZamvqE, Robert Dewitt */
.circle {
	display: inline-block;
	margin: 5px;
	border-radius: 50%;
	border: 5px solid #fff;
}

.circle-inner {
	color: white;
	display: table-cell;
	vertical-align: middle;
	text-align: center;
	text-decoration: none;
	height: 30px;
	width: 30px;
	font-size: 15px;
}

.border-me {
	border: 5px solid rgb(140, 105, 206);
}
</style>
