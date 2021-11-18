<script>
import { onMount } from "svelte";
import { debounce } from "debounce";
import { getColor, copyToClipboard, GENOMES, IGV_DEFAULTS } from "./utils";
import Cursor from "./Cursor.svelte";

export let username;
export let roomname;


// ===========================================================================
// State
// ===========================================================================

// WebSockets
let webSocket = null;

// IGV
let igvSettings = IGV_DEFAULTS;  // Initial settings used to initialize IGV
let browser = {};                // IGV object
let locusNbChanges = 0;          // How many times we've changed the locus (first time == initializing)
let locusPrev = null;            // Last locus (used to deduplicate messages)
let changingRegion = false;      // Whether user is currently changing the locus
let changingRegionTimer = null;  // Timer used to debounce updates to locus
let reference = "hg19";          // Reference genome currently used

// UI
let divIGV;                      // IGV element
let divContainer;                // Container element
let cursor;                      // Current user's cursor element
let cursors = {};                // { username: { x: 100, y: 100, timestamp: 123 } }
let isDoneCopy = false;          // Whether we're copying to clipboard


// ===========================================================================
// WebSocket Management
// ===========================================================================

// Send WebSocket message
function broadcast(data) {
	if(webSocket === null)
		return;
	webSocket.send(JSON.stringify(data));
}

function join() {
	let ws = new WebSocket(`wss://${window.location.host}/api/rooms/${roomname}/websocket`);
	let rejoined = false;
	let startTime = Date.now();
	let rejoin = async () => {
		if (!rejoined) {
			rejoined = true;
			webSocket = null;

			// Don't try to reconnect too rapidly.
			let timeSinceLastJoin = Date.now() - startTime;
			if (timeSinceLastJoin < 1000)
				await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastJoin));
			join();
		}
	}

	// When open connection, send user's name
	ws.addEventListener("open", event => {
		webSocket = ws;
		ws.send(JSON.stringify({ name: username }));
	});

	// Process incoming messages
	ws.addEventListener("message", event => {
		let data = JSON.parse(event.data);

		if(data.error) {
			console.error("WebSocket Error:", data.error);
		} else if (data.joined) {
			console.warn("Joined:", data);
			cursors[data.joined] = { x: 10, y: 10 };
		} else if (data.quit) {
			console.warn("Quit:", data);
			delete cursors[data.quit];
			cursors = cursors;  // force re-render
		} else if (data.ready) {
			console.log("Ready.")
		} else {
			handleMessage(data);
		}
	});

	ws.addEventListener("close", event => {
		console.log("WebSocket closed, reconnecting:", event.code, event.reason);
		rejoin();
	});
	ws.addEventListener("error", event => {
		console.log("WebSocket error, reconnecting:", event);
		rejoin();
	});
}


// ===========================================================================
// Handle messages
// ===========================================================================

function handleMessage(data) {
	// Update cursor
	if(data.cursor != null)
		updateCursor(data);

	// Update locus only if I'm not the one changing it already!
	else if(data.locus != null) {
		if(changingRegion === false && browser.currentLoci().join(" ") != data.locus)
			browser.search(data.locus);
	}

	// Update ref genome
	else if(data.reference != null) {
		reference = data.reference;
		browser.loadGenome(GENOMES[data.reference]);
	}

	// Unrecognized
	else {
		console.error("Unrecognized message:", data)
	}
}

function updateCursor(data) {
	// Don't update own cursor
	if(data.name === username)
		return;
	// If we haven't seen this cursor before
	if(!(data.name in cursors))
		cursors[data.name] = {};

	const [x, y, timestamp] = [data.cursor.x, data.cursor.y, data.timestamp];
	if(x == null || y == null) {
		delete cursors[data.name];
		cursors = cursors;  // force re-render
	} else {
		cursors[data.name] = { x, y, timestamp };
	}
}


// ===========================================================================
// Event handlers
// ===========================================================================

// On page load
onMount(() => {
	// Setup IGV
	igv.createBrowser(document.getElementById("igvDiv"), IGV_OPTIONS).then(function (br) {
		browser = br;
		console.log("Created IGV browser");

		// Connect to WebSocket
		join();

		// Set user pointer
		container.style.cursor = `url('data:image/svg+xml;base64,${btoa(cursor.outerHTML)}'), pointer`;

		// Listen to IGV events
		browser.on("locuschange", debounce(refFrames => {
			// If changing locus before IGV is ready, means we're just initializing the locus
			if(locusNbChanges++ < 1)
				return;

			// Support multi-loci!
			const locusCurr = browser.currentLoci().join(" ");
			// Don't broadcast a locus change if it hasn't changed!
			if(locusPrev === locusCurr)
				return;
			console.log("Set locus =", locusCurr);
			locusPrev = locusCurr;
			broadcast({ locus: locusCurr });

			// Reduce how many WebSockets messages we send
			clearTimeout(changingRegionTimer);
			changingRegion = true;
			changingRegionTimer = setTimeout(() => { changingRegion = false }, 500);
		}, 50));

		// TODO: Sync when delete/reorder tracks
		browser.on("trackremoved", function(tracks) {
			console.log("Removed tracks", tracks);
		});
		browser.on("trackorderchanged", function(tracks) {
			console.log("Moved tracks", tracks);
		});
	});
});

// When user changes ref genome
function handleRefGenome() {
	console.log("Set ref genome =", reference);
	broadcast({ reference });
}

// When user moves their pointer
function handlePointerMove(e) {
	// Detect going outside the container
	let x = e.clientX, y = e.clientY;
	if(x > divContainer.clientWidth || y > divContainer.clientHeight) {
		x = null;
		y = null;
	} else {
		broadcast({ cursor: {
			x: x != null ? Math.round(x) : null,
			y: y != null ? Math.round(y) : null
		}});
	}
}

// When user leaves container area
function handlePointerLeave(e) {
	if(e.clientX <= divContainer.clientWidth || e.clientY <= divContainer.clientHeight)
		return;
	broadcast({ cursor: { x: null, y: null } });
}

// When leave or refresh page
function handleUnload(e) {
	broadcast({ cursor: { x: null, y: null } });
};

// Add debounce to event handlers to reduce WebSockets events
handlePointerMove = debounce(handlePointerMove, 10);
handlePointerLeave = debounce(handlePointerLeave, 10);
</script>

<svelte:window on:beforeunload={handleUnload}/>

<!-- User's custom cursor to override the default cursor with-->
<svg bind:this={cursor}
	style="display:none"
	width="24"
	height="36"
	viewBox="0 0 24 36"
	fill={getColor(username)}
	xmlns="http://www.w3.org/2000/svg"
>
	<path d="M 8.553 13.433 L 11.511 19.256 L 9.083 20.717 L 6.176 14.382 L 2.433 17.229 L 2.433 1.544 L 12.79 12.907 L 8.553 13.433 Z"/>
</svg>

<!-- Cursors -->
{#each Object.keys(cursors) as name}
	<!-- Don't show old cursors -->
	{#if new Date().getTime() - cursors[name].timestamp < 100000}
		<Cursor {name} x={cursors[name].x} y={cursors[name].y} />
	{/if}
{/each}

<!-- Shared container -->
<div style="display:flex">
	<div id="container" bind:this={divContainer} on:pointermove={handlePointerMove} on:pointerleave={handlePointerLeave}>
		<div bind:this={divIGV}></div>
	</div>
	<div id="users">
		<h5>Share</h5>
		<div class="input-group mb-5">
			<input type="text" class="form-control form-control-sm" aria-label="URL to share with others" aria-describedby="button-share" value={String(window.location)} disabled>
			<button class="btn btn-sm btn-primary" type="button" id="button-share" on:click={() => copyToClipboard(String(window.location), () => {
				// Update UI
				isDoneCopy = true;
				setTimeout(() => isDoneCopy = false, 800);
			})}>
				Copy URL {#if isDoneCopy}✓{/if}
			</button>
		</div>

		<h5>Connected Users</h5>
		{#each Object.keys(cursors) as name}
			{#if cursors[name].timestamp == null || new Date().getTime() - cursors[name].timestamp < 1000000}
				<span style="color: {getColor(name)}">&#11044;</span> {name.split(":")[1]}
				{#if name === username}
					<strong>(me)</strong>
				{/if}
				<br />
			{/if}
		{/each}
		<a class="btn btn-sm btn-outline-secondary mt-3" href="?room=">Leave</a>

		<h5 class="mt-5">IGV Options</h5>
		<select class="form-select" aria-label="Choose a reference genome" bind:value={reference} on:change={handleRefGenome}>
			<optgroup label="Genome (maintains tracks but resets locus)">
				{#each Object.keys(GENOMES) as genomeID}
					<option value="{genomeID}">{GENOMES[genomeID].name}</option>
				{/each}
			</optgroup>
		</select>
	</div>
</div>

<style>
#container {
	height: 500px;
	width: 700px;
	border: 1px solid lightgray;
	overflow-x: hidden;
	overflow-y: hidden;
}

#users {
	margin-left: 20px;
}
</style>
