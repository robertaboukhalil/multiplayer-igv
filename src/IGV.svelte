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
let igvBrowser = {};             // IGV object
let igvLocusPrev = null;         // Last locus (used to deduplicate messages)
let igvGenome;                   // Reference genome currently used

// UI
let divIGV;                      // IGV element
let divContainer;                // Container element
let svgCursor;                   // Current user's cursor element
let isDoneCopy = false;          // Whether we're copying to clipboard
let cursors = {};                // Location of all cursors: { username: { x: 100, y: 100, timestamp: 123 } }


// ===========================================================================
// IGV Management
// ===========================================================================

// Setup IGV
function igvInit(settings) {
	// Update default settings as needed
	for(let key in settings) {
		const value = settings[key];
		if(key === "genome") {
			igvGenome = value || "hg19";
			igvSettings.reference = GENOMES[igvGenome];
		} else {
			igvSettings[key] = value;
		}
	}

	// Create IGV instance
	igv.createBrowser(divIGV, igvSettings).then(browser => {
		igvBrowser = browser;
		console.log("Created IGV browser", igvSettings);

		// Listen to events
		igvBrowser.on("locuschange", debounce(igvLocusChange, 50));
		igvBrowser.on("trackremoved", igvTrackRemove);
		igvBrowser.on("trackorderchanged", igvTrackOrderChanged);
	});
}

// Broadcast a locus change (called by IGV)
function igvLocusChange() {
	// Don't broadcast if locus hasn't changed!
	const locus = igvBrowser.currentLoci().join(" ");
	if(igvLocusPrev === locus)
		return;

	console.log("Set locus =", locus);
	igvLocusPrev = locus;
	broadcast({ locus: locus });
}

// TODO:
function igvTrackRemove(track) { console.log("Removed track:", track); }
function igvTrackOrderChanged(tracks) { console.log("New track order:", tracks); }


// ===========================================================================
// WebSocket Management
// ===========================================================================

// Send WebSocket message
function broadcast(data) {
	if(webSocket === null)
		return;
	webSocket.send(JSON.stringify(data));
}

// Connect to the backend via WebSockets
function join() {
	let ws = new WebSocket(`wss://${window.location.host}/api/rooms/${roomname}`);
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
		if(data.error)
			return console.error("WebSocket Error:", data.error);

		// Wait for IGV settings before initializing IGV
		if(data.igvinit) {
			igvInit(data.igvinit);
		// Process user joining / leaving the room
		} else if(data.joined) {
			console.warn("Joined:", data);
			cursors[data.joined] = {};  // make sure the new user is listed on the side
		} else if(data.quit) {
			console.warn("Quit:", data);
			delete cursors[data.quit];
			cursors = cursors;  // force re-render
		} else if (data.ready) {
			console.log("Ready.");
		// Otherwise, the message is to update a setting
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
	// Update cursor position
	if(data.cursor != null)
		updateCursor(data);
	// Update locus only if it's different than where I am
	else if(data.locus != null && igvBrowser.currentLoci().join(" ") != data.locus)
		igvBrowser.search(data.locus);
	// Unknown message
	else
		console.warn("Ignoring message:", data)
}

// Update a cursor's position
function updateCursor(data) {
	// Basic input validation + don't update own cursor
	if(data.name === username)
		return;
	if(!(data.name in cursors))
		cursors[data.name] = {};

	// Move cursor to new location (or hide it)
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
	// Connect to WebSocket
	join();

	// Override default pointer when user is within the container div
	divContainer.style.cursor = `url('data:image/svg+xml;base64,${btoa(svgCursor.outerHTML)}'), pointer`;
});

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
<svg bind:this={svgCursor}
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

		<h5 class="mt-5">IGV</h5>
		{#if igvGenome}
			Genome: {GENOMES[igvGenome].name}
		{/if}
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
