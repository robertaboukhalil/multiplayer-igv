import App from './App.svelte';

const app = new App({
	target: document.body,
});

export default app;


// import { ulid } from "ulid";

// let currentWebSocket = null;
// let username = `${ulid()}:robert`;
// let roomname = "test";
// let hostname = window.location.host;
// let browser = {};  // IGV object
// let browserChangeLocus = 0;  // How many times we've changed the locus (first time == initializing)
// let changingRegion = false;
// let changingRegionTimer = null;
// let prevX = 0, prevY = 0, prevLocus = null;

// const container = document.getElementById("container");

// // Source: https://github.com/d3/d3-scale-chromatic/blob/main/src/categorical/category10.js
// const COLORS = ["#1f77b4","#ff7f0e","#2ca02c","#d62728","#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22","#17becf"]
// const IGV_OPTIONS = {
// 	// Example of fully specifying a reference. We could alternatively use "genome: 'hg19'"
// 	reference: {
// 			id: "hg19",
// 			fastaURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/1kg_v37/human_g1k_v37_decoy.fasta",
// 			cytobandURL: "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/b37/b37_cytoband.txt"
// 	},
// 	locus: "8:128,750,948-128,751,025",
// 	tracks: [{
// 			type: 'alignment',
// 			format: 'cram',
// 			url: 'https://s3.amazonaws.com/1000genomes/phase3/data/HG00096/exome_alignment/HG00096.mapped.ILLUMINA.bwa.GBR.exome.20120522.bam.cram',
// 			indexURL: 'https://s3.amazonaws.com/1000genomes/phase3/data/HG00096/exome_alignment/HG00096.mapped.ILLUMINA.bwa.GBR.exome.20120522.bam.cram.crai',
// 			name: 'HG00096',
// 			displayMode: "SQUISHED",
// 			sort: {
// 					chr: "chr8",
// 					position: 128750986,
// 					option: "BASE",
// 					direction: "ASC"
// 			},
// 			height: 600
// 	}]
// };

// // ---------------------------------------------------------------------------
// // Utilities
// // ---------------------------------------------------------------------------

// // Send WebSocket message
// function broadcast(data) {
// 	if(currentWebSocket === null)
// 		return;
// 	currentWebSocket.send(JSON.stringify(data));
// }

// // Generate a color from a user ID
// function getColor(user) {
// 	return COLORS[Math.abs(user.hash()) % COLORS.length];
// }

// // Show user's own pointer once window is out of focus (e.g. in case they open
// // two windows side by side). This is removed when the user moves the mouse.
// // Note: document.addEventListener with "focusin" and "focusout" didnt' work.
// function checkFocus() {
// 	if(!document.hasFocus()) {
// 		updateCursor({ name: username, cursor: { x: prevX, y: prevY } }, true);
// 	}
// 	setTimeout(checkFocus, 500);
// }

// // Debounce. Source: https://github.com/m-gagne/limit.js/blob/master/limit.js
// Function.prototype.debounce = function(milliseconds, context) {
// 		var baseFunction = this, timer = null, wait = milliseconds;
// 		return function () {
// 				var self = context || this, args = arguments;
// 				function complete() { baseFunction.apply(self, args); timer = null; }
// 				if(timer)
// 						clearTimeout(timer);
// 				timer = setTimeout(complete, wait);
// 		};
// };

// // Hashing function. Source: https://stackoverflow.com/a/7616484
// String.prototype.hash = function() {
// 	var hash = 0, i, chr;
// 	if (this.length === 0) return hash;
// 	for (i = 0; i < this.length; i++) {
// 		chr   = this.charCodeAt(i);
// 		hash  = ((hash << 5) - hash) + chr;
// 		hash |= 0; // Convert to 32bit integer
// 	}
// 	return hash;
// };


// // ---------------------------------------------------------------------------
// // WebSocket Management
// // ---------------------------------------------------------------------------

// function join() {
// 	let ws = new WebSocket("wss://" + hostname + "/api/room/" + roomname + "/websocket");
// 	let rejoined = false;
// 	let startTime = Date.now();

// 	let rejoin = async () => {
// 		if (!rejoined) {
// 			rejoined = true;
// 			currentWebSocket = null;

// 			// Don't try to reconnect too rapidly.
// 			let timeSinceLastJoin = Date.now() - startTime;
// 			if (timeSinceLastJoin < 1000)
// 				await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastJoin));
// 			join();
// 		}
// 	}

// 	// When open connection, send user's name
// 	ws.addEventListener("open", event => {
// 		currentWebSocket = ws;
// 		ws.send(JSON.stringify({ name: username }));
// 	});

// 	// Process incoming messages
// 	ws.addEventListener("message", event => {
// 		let data = JSON.parse(event.data);

// 		if(data.error) {
// 			console.error("WebSocket Error:", data.error);
// 		} else if (data.joined) {
// 			console.warn("JOINED", data);
// 		} else if (data.quit) {
// 			console.warn("QUIT", data);
// 			let cursor = document.getElementById(`cursor-${data.quit}`);
// 			if (cursor != null)
// 				cursor.remove();
// 		} else if (data.ready) {
// 			console.log("Ready.")
// 		} else {
// 			handleMessage(data);
// 		}
// 	});

// 	ws.addEventListener("close", event => {
// 		console.log("WebSocket closed, reconnecting:", event.code, event.reason);
// 		rejoin();
// 	});
// 	ws.addEventListener("error", event => {
// 		console.log("WebSocket error, reconnecting:", event);
// 		rejoin();
// 	});
// }


// // ---------------------------------------------------------------------------
// // Handle messages
// // ---------------------------------------------------------------------------

// function handleMessage(data) {
// 	// Update cursor
// 	if(data.cursor != null)
// 		updateCursor(data);

// 	// Update locus only if I'm not the one changing it already!
// 	else if(data.locus != null) {
// 		if(changingRegion === false && browser.currentLoci()[0] != data.locus)
// 			browser.search(data.locus);
// 	}

// 	// Unrecognized
// 	else {
// 		console.error("Unrecognized message:", data)
// 	}
// }

// function updateCursor(data, doit=false) {
// 	if(data.name === username && doit === false)
// 		return;

// 	// Create cursor if not there yet
// 	let cursor = document.getElementById(`cursor-${data.name}`);
// 	if (cursor == null) {
// 		cursor = document.getElementById("cursor-template").cloneNode(true);
// 		cursor.id = `cursor-${data.name}`;
// 		cursor.style.fill = getColor(data.name);
// 		document.body.appendChild(cursor);
// 	}

// 	// Update its position
// 	if(data.cursor.x != null && data.cursor.y != null) {
// 		cursor.style.transform = `translateX(${data.cursor.x}px) translateY(${data.cursor.y}px)`;
// 		cursor.style.opacity = "1";
// 	} else {
// 		cursor.style.opacity = "0";
// 	}
// }


// // ---------------------------------------------------------------------------
// // Event handlers
// // ---------------------------------------------------------------------------

// // On page load
// document.addEventListener("DOMContentLoaded", function () {
// 	// Setup IGV
// 	igv.createBrowser(document.getElementById("igvDiv"), IGV_OPTIONS).then(function (br) {
// 		browser = br;
// 		console.log("Created IGV browser");

// 		// TODO: Hide unsupported features
// 		const unsupported = [
// 			".igv-gear-menu-column > div:nth-child(3)"  // Reference track settings
// 		];
// 		unsupported.forEach(elQuery => {
// 			document.querySelectorAll(elQuery)
// 							.forEach(el => el.style.visibility = "hidden");
// 		});

// 		// Connect to WebSocket
// 		join();
// 		checkFocus();

// 		// Listen to IGV events
// 		browser.on("locuschange", function(refFrame) {
// 			// If changing locus before IGV is ready, means we're just initializing the locus
// 			if(browserChangeLocus++ < 1)
// 				return;

// 			// Don't broadcast a locus change if it hasn't changed!
// 			if(prevLocus === refFrame[0].getLocusString())
// 				return;
// 			console.log("Set locus =", refFrame[0].getLocusString());
// 			prevLocus = refFrame[0].getLocusString();
// 			broadcast({ locus: refFrame[0].getLocusString() });

// 			// Reduce how many WebSockets messages we send
// 			clearTimeout(changingRegionTimer);
// 			changingRegion = true;
// 			changingRegionTimer = setTimeout(() => { changingRegion = false; }, 500)
// 		}.debounce(50));

// 		// TODO: Sync when remove tracks
// 		browser.on("trackremoved", function(tracks) {
// 			console.log("Remove tracks", tracks);
// 		});
// 	});

// 	// Set user's pointer
// 	const cursor = document.getElementById("cursor-template");
// 	cursor.style.fill = getColor(username);
// 	container.style.cursor = `url('data:image/svg+xml;base64,${btoa(cursor.outerHTML)}'), pointer`;
// 	cursor.style.fill = "transparent";
// });

// // When user moves their pointer
// container.addEventListener("pointermove", function (e) {
// 	// Remove user's own pointer *if* it's there
// 	try {
// 		document.getElementById(`cursor-${username}`).remove();
// 	} catch (error) {}

// 	// Detect going outside the container
// 	let x = e.clientX, y = e.clientY;
// 	if(x > container.clientWidth || y > container.clientHeight) {
// 		x = null;
// 		y = null;
// 	} else {
// 		prevX = x;
// 		prevY = y;
// 	}
// 	broadcast({ cursor: { x, y } });
// }.debounce(10));

// // When user leaves container area
// container.addEventListener("pointerleave", function (e) {
// 	if(e.clientX <= container.clientWidth || e.clientY <= container.clientHeight)
// 		return
// 	broadcast({ cursor: { x: null, y: null } });
// }.debounce(10));

// // When leave or refresh page
// document.addEventListener("unload", function(e){
// 	broadcast({ cursor: { x: null, y: null } });
// });
