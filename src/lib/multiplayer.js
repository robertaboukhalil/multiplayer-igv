import hash from "string-hash";
import { nanoid } from "nanoid";

// =============================================================================
// Multiplayer class
// =============================================================================

const CURSOR_USE_PERCENT = false;
const SUPABASE_REALTIME_STATUS_SUBSCRIBED = "SUBSCRIBED";

export class Multiplayer {
	constructor(params) {
		// Set up params
		this.client = params.client;
		this.screen = params.screen;
		this.onUpdateUsers = params.onUpdateUsers;
		this.onUpdateCursors = params.onUpdateCursors;
		this.onClick = params.onClick;
		this.usersOnline = {}; // Users that are still connected, e.g. {"uuid": {"name": "bla"}}
		this.usersCursors = {}; // All cursor positions
		this.me = {
			id: nanoid(10),
			name: params.user
		};

		// Set up WebSocket channel
		this.channel = this.client.channel(params.channel);
		this.channel
			.on("presence", { event: "sync" }, this.onSupabasePresenceSync.bind(this))
			.on("broadcast", { event: "cursor" }, this.onSupabaseBroadcastCursor.bind(this))
			.on("broadcast", { event: "click" }, this.onSupabaseBroadcastClick.bind(this))
			.subscribe(this.onSupabaseSubscribe.bind(this));
	}

	// =========================================================================
	// Supabase event handlers
	// =========================================================================

	// Subscribe current user to channel
	async onSupabaseSubscribe(status) {
		console.log("Status =", status);
		if (status === SUPABASE_REALTIME_STATUS_SUBSCRIBED) {
			await this.channel.track({
				id: this.me.id,
				name: this.me.name
			});
		}
	}

	// Whenever the presence of users changes, update our internal state
	onSupabasePresenceSync() {
		const presence = this.channel.presenceState();
		// Remap presence using our UUIDs (could also cleanup cursors but not a large memory use)
		const state = {};
		for (const id of Object.keys(presence)) {
			state[presence[id][0].id] = presence[id][0];
		}
		this.usersOnline = state;
		this.onUpdateUsers(this.usersOnline);
	}

	onSupabaseBroadcastCursor({ payload }) {
		if (payload.id) {
			this.usersCursors[payload.id] = { x: payload.x, y: payload.y };
			this.onUpdateCursors(this.usersCursors);
		}
	}

	onSupabaseBroadcastClick({ payload }) {
		if (payload.id) {
			this.usersCursors[payload.id] = { x: payload.x, y: payload.y };
			this.onUpdateCursors(this.usersCursors);
			this.onClick(payload);
			setTimeout(() => this.onClick(false), 300);
		}
	}

	// =========================================================================
	// Broadcast events
	// =========================================================================

	// Broadcast updated x/y mouse coordinates
	broadcastPointerMove(event) {
		const position = this.getCursorPositionSend(event.clientX, event.clientY);
		this.channel.send({
			type: "broadcast",
			event: "cursor",
			payload: { ...position, id: this.me.id }
		});
	}

	// Broadcast x/y coordinates to null
	broadcastPointerLeave(event) {
		if (event.clientX <= this.screen.clientWidth || event.clientY <= this.screen.clientHeight) return;
		this.channel.send({
			type: "broadcast",
			event: "cursor",
			payload: { x: null, y: null, id: this.me.id }
		});
	}

	// Broadcast mouse click
	broadcastClick(event) {
		const position = this.getCursorPositionSend(event.clientX, event.clientY);
		this.channel.send({
			type: "broadcast",
			event: "click",
			payload: { ...position, id: this.me.id }
		});
	}

	// =========================================================================
	// Internal utilities
	// =========================================================================

	// Calculate user's cursor position before sending to channel
	getCursorPositionSend(x, y) {
		if (CURSOR_USE_PERCENT) {
			return {
				x: Math.round(((x - this.screen.offsetLeft) / this.screen.clientWidth) * 10000) / 100,
				y: Math.round(((y - this.screen.offsetTop) / this.screen.clientHeight) * 10000) / 100
			};
		}
	
		return {
			x: Math.round(x - this.screen.offsetLeft),
			y: Math.round(y - this.screen.offsetTop)
		};
	}

	// Calculate another user's cursor position that we received
	getCursorPositionReceive(x, y) {
		if (CURSOR_USE_PERCENT) {
			return {
				x: (x / 100) * this.screen.clientWidth + this.screen.offsetLeft,
				y: (y / 100) * this.screen.clientHeight + this.screen.offsetTop
			};
		}

		return {
			x: Math.round(x + this.screen.offsetLeft),
			y: Math.round(y + this.screen.offsetTop)
		};
	}

	// =========================================================================
	// Static class utilities
	// =========================================================================

	// Hash string into color (for choosing a user's color based on their name)
	static getHashColor(str) {
		// Source: Cyclical/Rainbow: https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
		const colors = ["#6e40aa", "#bf3caf", "#fe4b83", "#ff7847", "#e2b72f", "#aff05b", "#52f667", "#1ddfa3", "#23abd8", "#4c6edb", "#6e40aa"];
		return colors[Math.abs(hash(str)) % colors.length];
	}

	// Get initials from a name
	static getInitials(name = "") {
		const initials = name
			.toUpperCase()
			.split(" ")
			.map((name) => name[0]);
		if (initials.length === 1) return initials[0];
		return `${initials[0]}${initials[initials.length - 1]}`;
	}
}


// =============================================================================
// IGV class
// =============================================================================

const IGV_DEFAULTS = {
	showCenterGuide: false,
	showCursorTrackingGuide: false,
	showTrackLabels: true,
	tracks: []
};

export class IGV {
	igv = null;      // IGV library
	browser = null;  // IGV Browser object
	// ready = false;   // Ready for it's state to be synced
	room = {};       // Associated Room object
	settings = IGV_DEFAULTS;
	trackremoved = () => {};

	// Create IGV browser
	async init({ div, genome, room, tracks }) {
		// Don't reinitialize if we did already (happens if ?)
		if(this.ready) {
			console.log("IGV already initialized");
			return;
		}

		// // Initialize genome and tracks
		// this.room = room;
		this.settings.genome = genome;
		// this.settings.tracks = tracks;

		// Create IGV browser
		this.igv = (await import("igv")).default;
		this.igv.createBrowser(div, this.settings).then(browser => {
			this.browser = browser;
			console.log("Created IGV browser", browser);

			// // IGV sometimes auto adapts chr names, e.g. 8 --> chr8. This avoids an infinite loop.
			// this.settings.locus = this.get("locus");
			// this.ready = true;

			// // Listen to locus change
			// this.browser.on("locuschange", debounce(() => {
			// 	const locus = this.get("locus");
			// 	if(locus != this.settings.locus) {
			// 		this.settings.locus = locus;
			// 		this.room.broadcast({ locus });  // won't interpret self-message because settings.locus is already updated
			// 	}
			// }, 50));

			// // Listen to changes in center/cursor guides visibility
			// this.browser.centerLineButton.button.addEventListener("click", () => {
			// 	this.room.broadcast({ showCenterGuide: this.get("showCenterGuide") });
			// });
			// this.browser.cursorGuideButton.button.addEventListener("click", () => {
			// 	this.room.broadcast({ showCursorTrackingGuide: this.get("showCursorTrackingGuide") });
			// });
			// this.browser.trackLabelControl.button.addEventListener("click", () => {
			// 	this.room.broadcast({ showTrackLabels: this.get("showTrackLabels") });
			// });
			// // Listen to removed tracks
			// this.browser.on("trackremoved", this.trackremoved);
		});
	}

	// Get an IGV setting
	get(setting) {
		if(setting === "locus")
			return this.browser.currentLoci().join(" ");
		else if(setting === "showCenterGuide")
			return this.browser.centerLineList[0].isVisible;
		else if(setting === "showCursorTrackingGuide")
			return this.browser.cursorGuide.horizontalGuide.style.display !== "none";
		else if(setting === "showTrackLabels")
			return this.browser.trackLabelsVisible;
	}

	// Set an IGV setting
	async set(setting, value) {
		console.log(`Set |${setting}| = |${value}|`)
		// If already at the value of interest, don't do anything
		if(this.get(setting) == value)
			return;

		// Update locus
		if(setting === "locus")
			await this.browser.search(value);

		// Cursor guides are boolean ==> click button if value doesn't match
		else if(setting === "showCenterGuide")
			this.browser.centerLineButton.button.click();
		else if(setting === "showCursorTrackingGuide")
			this.browser.cursorGuideButton.button.click();
		else if(setting === "showTrackLabels")
			this.browser.trackLabelControl.button.click();
	}

	// Load tracks defined as JSON config
	async loadTracks(tracks) {
		console.log("Adding tracks:", tracks);
		return await this.browser.loadTrackList(tracks);
	}

	// Delete tracks defined by their order
	async deleteTracks(orders) {
		console.log("Deleting tracks:", orders);
		for(let order of orders) {
			const track = this.browser.findTracks(t => t.order == order).find(d => d);
			this.browser.removeTrack(track);
		}
	}
}
