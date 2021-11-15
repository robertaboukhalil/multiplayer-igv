<script>
import { onMount } from "svelte";
import { ulid } from "ulid";
import { debounce } from "debounce";

import Cursor from "./Cursor.svelte";


// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

let currentWebSocket = null;
let username = `${ulid()}:robert`;
let roomname = "test";
let browser = {};  // IGV object
let browserChangeLocus = 0;  // How many times we've changed the locus (first time == initializing)
let changingRegion = false;
let changingRegionTimer = null;
let prevX = 0, prevY = 0, prevLocus = null;
let container;  // Element #container

// Source: https://github.com/d3/d3-scale-chromatic/blob/main/src/categorical/category10.js
const IGV_OPTIONS = {
	// Example of fully specifying a reference. We could alternatively use "genome: 'hg19'"
	reference: {
		id: "hg19",
		fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/1kg_v37/human_g1k_v37_decoy.fasta",
		cytobandURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/b37/b37_cytoband.txt"
	},
	locus: "8:128,750,948-128,751,025",
	tracks: [{
		type: 'alignment',
		format: 'cram',
		url: 'https://s3.amazonaws.com/1000genomes/phase3/data/HG00096/exome_alignment/HG00096.mapped.ILLUMINA.bwa.GBR.exome.20120522.bam.cram',
		indexURL: 'https://s3.amazonaws.com/1000genomes/phase3/data/HG00096/exome_alignment/HG00096.mapped.ILLUMINA.bwa.GBR.exome.20120522.bam.cram.crai',
		name: 'HG00096',
		displayMode: "SQUISHED",
		sort: {
			chr: "chr8",
			position: 128750986,
			option: "BASE",
			direction: "ASC"
		},
		height: 600
	}]
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let cursors = {};  // { username: { x: 100, y: 100, hidden: false } }


// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

// Send WebSocket message
function broadcast(data) {
	if(currentWebSocket === null)
		return;
	currentWebSocket.send(JSON.stringify(data));
}


// ---------------------------------------------------------------------------
// WebSocket Management
// ---------------------------------------------------------------------------

function join() {
	let ws = new WebSocket(`wss://${window.location.host}/api/room/${roomname}/websocket`);
	let rejoined = false;
	let startTime = Date.now();

	let rejoin = async () => {
		if (!rejoined) {
			rejoined = true;
			currentWebSocket = null;

			// Don't try to reconnect too rapidly.
			let timeSinceLastJoin = Date.now() - startTime;
			if (timeSinceLastJoin < 1000)
				await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastJoin));
			join();
		}
	}

	// When open connection, send user's name
	ws.addEventListener("open", event => {
		currentWebSocket = ws;
		ws.send(JSON.stringify({ name: username }));
	});

	// Process incoming messages
	ws.addEventListener("message", event => {
		let data = JSON.parse(event.data);

		if(data.error) {
			console.error("WebSocket Error:", data.error);
		} else if (data.joined) {
			console.warn("JOINED", data);
		} else if (data.quit) {
			console.warn("QUIT", data);
			delete cursors[data.quit];
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


// ---------------------------------------------------------------------------
// Handle messages
// ---------------------------------------------------------------------------

function handleMessage(data) {
	// Update cursor
	if(data.cursor != null)
		updateCursor(data);

	// Update locus only if I'm not the one changing it already!
	else if(data.locus != null) {
		if(changingRegion === false && browser.currentLoci()[0] != data.locus)
			browser.search(data.locus);
	}

	// Unrecognized
	else {
		console.error("Unrecognized message:", data)
	}
}

function updateCursor(data) {
	// If we haven't seen this cursor before
	if(!(data.name in cursors))
		cursors[data.name] = {};

	const x = data.cursor.x;
	const y = data.cursor.y;
	if(x == null || y == null)
		delete cursors[data.name];
	else {
		cursors[data.name].x = x;
		cursors[data.name].y = y;
	}
}


// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

// On page load
onMount(() => {
	// Setup IGV
	igv.createBrowser(document.getElementById("igvDiv"), IGV_OPTIONS).then(function (br) {
		browser = br;
		console.log("Created IGV browser");

		// TODO: Hide unsupported features
		const unsupported = [
			".igv-gear-menu-column > div:nth-child(3)"  // Reference track settings
		];
		unsupported.forEach(elQuery => {
			document.querySelectorAll(elQuery)
							.forEach(el => el.style.visibility = "hidden");
		});

		// Connect to WebSocket
		join();
		checkFocus();

		// Listen to IGV events
		browser.on("locuschange", debounce(refFrame => {
			// If changing locus before IGV is ready, means we're just initializing the locus
			if(browserChangeLocus++ < 1)
				return;

			// Don't broadcast a locus change if it hasn't changed!
			if(prevLocus === refFrame[0].getLocusString())
				return;
			console.log("Set locus =", refFrame[0].getLocusString());
			prevLocus = refFrame[0].getLocusString();
			broadcast({ locus: refFrame[0].getLocusString() });

			// Reduce how many WebSockets messages we send
			clearTimeout(changingRegionTimer);
			changingRegion = true;
			changingRegionTimer = setTimeout(() => { changingRegion = false; }, 500)
		}, 50));

		// TODO: Sync when remove tracks
		browser.on("trackremoved", function(tracks) {
			console.log("Remove tracks", tracks);
		});
	});


	// Initialize user's pointer
	cursors[username] = {
		x: 100,
		y: 100
	};
});

// When user moves their pointer
function handlePointerMove(e) {
	// Detect going outside the container
	let x = e.clientX, y = e.clientY;
	if(x > container.clientWidth || y > container.clientHeight) {
		x = null;
		y = null;
	} else {
		prevX = x;
		prevY = y;
	}
	broadcast({ cursor: {
		x: Math.round(x),
		y: Math.round(y)
	} });
}

// When user leaves container area
function handlePointerLeave(e) {
	if(e.clientX <= container.clientWidth || e.clientY <= container.clientHeight)
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

<svelte:window on:unload={handleUnload}/>

<!-- Cursors -->
{#each Object.keys(cursors) as name}
	<Cursor {name} x={cursors[name].x} y={cursors[name].y} />
{/each}

<!-- Shared container -->
<div id="container" bind:this={container} on:pointermove={handlePointerMove} on:pointerleave={handlePointerLeave}>
	<div id="igvDiv"></div>
</div>

<style>
#container {
	height: 500px;
	width: 700px;
	border: 1px solid lightgray;
	overflow-x: hidden;
	overflow-y: hidden;
}
</style>
