<script>
import { onMount } from "svelte";
import { debounce } from "debounce";
import localforage from "localforage";
import { getColor, copyToClipboard, GENOMES, IGV_DEFAULTS } from "../utils";
import Cursor from "./Cursor.svelte";
import FormCheckbox from "./FormCheckbox.svelte";
import FormDropdown from "./FormDropdown.svelte";

export let roomID;
export let userID;


// ===========================================================================
// State
// ===========================================================================

// WebSockets
let webSocket = null;

// Room
let roomName = "";               // Room name

// UI
let divIGV;                      // IGV element
let divContainer;                // Container element
let svgCursor;                   // Current user's cursor element
let isDoneCopy = false;          // Whether we're copying to clipboard
let cursors = {};                // Location of all cursors: { userID: { x: 100, y: 100, timestamp: 123 } }

// IGV
let igvSettings = IGV_DEFAULTS;  // Settings object used to initialize IGV
let igvBrowser = null;           // IGV object
let igvReady = false;            // Whether igv has been fully initialized
let syncReady = false;           // Ready to start syncing updates?

// IGV settings that can change in the room
const IGV_SETTINGS = {
	"genome": {
		get: () => igvBrowser.toJSON().reference.id,
		set: async value => {
			igvBrowser.removeAllTracks();
			return await igvBrowser.loadGenome(value);
		}
	},
	"locus": {
		get: () => igvBrowser.currentLoci().join(" "),
		set: async value => await igvBrowser.search(value),
		event: true
	},
	"showCenterGuide": {
		get: () => igvBrowser.centerLineList[0].isVisible,
		set: value => igvBrowser.setCenterLineVisibility(value)
	},
	"showCursorTrackingGuide": {
		get: () => igvBrowser.cursorGuide.horizontalGuide.style.display !== "none",
		set: value => igvBrowser.setCursorGuideVisibility(value)
	}
};


// ===========================================================================
// IGV Management
// ===========================================================================

$: igvBroadcastChanges(igvSettings);

// Setup IGV
function igvInit(settings) {
	// Don't initialize twice (this would be called twice if websocket disconnects)
	if(igvBrowser !== null)
		return;

	// Update default settings as needed
	console.log("Got init settings:", settings)
	for(let key in settings)
		igvSettings[key] = settings[key];

	// Create IGV instance
	igv.createBrowser(divIGV, igvSettings).then(browser => {
		igvBrowser = browser;
		igvReady = true;
		console.log("Created IGV browser", igvSettings);

		// IGV sometimes auto adapts chromosome names, e.g. 8 --> chr8.
		// This avoids an infinite loop caused by .get() != igvSettings.locus
		igvSettings.locus = IGV_SETTINGS.locus.get();
		syncReady = true;

		// Listen to events
		igvBrowser.on("locuschange", debounce(() => {
			const locus = IGV_SETTINGS.locus.get();
			if(locus != igvSettings.locus) {
				igvSettings.locus = locus;  // no-op b/c we're setting igvSettings.locus = IGV_SETTINGS.locus.get()
				broadcast({ locus });       // won't interpret self-message because igvSettings.locus is already updated
			}
		}, 50));
		// TODO: igvBrowser.on("trackremoved", igvTrackRemove);
		// TODO: igvBrowser.on("trackorderchanged", igvTrackOrderChanged);
	});
}

// Broadcast changes to settings
function igvBroadcastChanges() {
	if(!syncReady)
		return;

	for(let setting in IGV_SETTINGS) {
		const info = IGV_SETTINGS[setting];
		// IGV events, i.e. `igvBrowser.on("...")`, need to send their own
		// broadcast() messages, so avoid duplicating them here
		if(info.event === true)
			continue;
		const valueNew = igvSettings[setting];
		const valuePrev = info.get();
		if(valueNew != null && valueNew != valuePrev) {
			console.log(`Broadcast ${setting} = |${valueNew}|; oldValue = |${valuePrev}|`);
			broadcast({ [setting]: valueNew });
		}
	}
}


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
	let ws = new WebSocket(`wss://${window.location.host}/api/rooms/${roomID}`);
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
		ws.send(JSON.stringify({ name: userID }));
	});

	// Process incoming messages
	ws.addEventListener("message", async event => {
		let data = JSON.parse(event.data);
		if(data.error)
			return console.error("WebSocket Error:", data.error);

		// Wait for IGV settings before initializing IGV
		if(data.igvinit) {
			igvInit(data.igvinit);
		// Process info about this room and remember it
		} else if(data.init) {
			roomName = data.init.roomName || "Untitled";
			const rooms = await localforage.getItem("rooms") || []
			if(roomID && rooms.filter(room => room.id === roomID).length === 0)
				await localforage.setItem("rooms", rooms.concat([{ id: roomID, name: roomName }]));
		// Process user joining / leaving the room
		} else if(data.joined) {
			console.warn("Joined:", data);
			cursors[data.joined] = {};  // make sure the new user is listed on the side
		} else if(data.quit) {
			console.warn("Quit:", data);
			delete cursors[data.quit];
			cursors = cursors;  // force re-render
		} else if (data.ready) {
			console.log("Ready");
		// Otherwise, the message is to update a setting
		} else {
			await handleMessage(data);
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

async function handleMessage(data) {
	// Update IGV settings if they're non-null and have changed value
	let updated = false;
	if(syncReady) {
		for(let setting in IGV_SETTINGS) {
			const valueNew = data[setting];
			const valuePrev = IGV_SETTINGS[setting].get();
			if(valueNew != null && valueNew != valuePrev) {
				console.log("Handle message:", setting, valuePrev, valueNew)
				igvSettings[setting] = valueNew;  // update igvSettings so that .set() call doesn't trigger an event again
				await IGV_SETTINGS[setting].set(valueNew);
				updated = true;
			}
		}
	}

	// Update cursor position
	if(data.cursor != null) {
		updateCursor(data);

	// Unknown message
	} else if(!updated) {
		console.warn("Ignoring message:", data)
	}
}

// Update a cursor's position
function updateCursor(data) {
	// Basic input validation + don't update own cursor
	if(data.name === userID)
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
	fill={getColor(userID)}
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
		<!-- Show room name and shareable link -->
		<h3>{roomName}</h3>
		<div class="input-group input-group-sm">
			<span class="input-group-text">Shareable Link:</span>
			<input type="text" class="form-control" value={String(window.location)}>
			<button class="btn btn-primary" type="button" on:click={() => copyToClipboard(String(window.location), () => {
				// Update UI
				isDoneCopy = true;
				setTimeout(() => isDoneCopy = false, 800);
			})}>
				Copy {#if isDoneCopy}✓{/if}
			</button>
		</div>

		<!-- Show synced options -->
		<h5 class="mt-5">IGV Options</h5>
		{#if igvBrowser === null}
			⌛
		{:else}

			<FormCheckbox
				bind:checked={igvSettings.showCenterGuide}	
				label="Center Guide" />

			<FormCheckbox
				bind:checked={igvSettings.showCursorTrackingGuide}	
				label="Cursor Guide" />

			<FormDropdown
				bind:selected={igvSettings.genome}
				label="Ref. Genome"
				labelOpt="&#9888; Warning: changing genomes resets the view"
				values={Object.keys(GENOMES)}
				fnDesc={genomeID => GENOMES[genomeID].name} />

		{/if}

		<!-- List of users -->
		<h5 class="mt-5">Connected Users</h5>
		{#each Object.keys(cursors) as id}
			{#if cursors[id].timestamp == null || new Date().getTime() - cursors[id].timestamp < 1000000}
				<span style="color: {getColor(id)}">&#11044;</span> {id.split(":")[1]}
				{#if id === userID}
					<strong>(me)</strong>
				{/if}
				<br />
			{/if}
		{/each}
		<a class="btn btn-sm btn-outline-secondary mt-3" href="/">Leave</a>
	</div>
</div>

<style>
#container {
	width: 600px;
	overflow-x: hidden;
	border: 1px solid lightgray;
}

#users {
	margin-left: 20px;
}
</style>
