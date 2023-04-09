import hash from "string-hash";
import { nanoid } from "nanoid";

// =============================================================================
// Multiplayer class
// =============================================================================

const SUPABASE_REALTIME_STATUS_SUBSCRIBED = "SUBSCRIBED";

export class Multiplayer {
	constructor(params) {
		// Set up params
		this.client = params.client;
		this.screen = params.screen;
		this.onUpdateUsers = params.onUpdateUsers;
		this.onUpdateCursors = params.onUpdateCursors;
		this.onClick = params.onClick;
		this.onPayload = params.onPayload;
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
			.on("broadcast", { event: "app" }, this.onSupabaseBroadcastAppEvent.bind(this))
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

	onSupabaseBroadcastAppEvent({ payload }) {
		this.onPayload(payload);
	}

	// =========================================================================
	// Broadcast events
	// =========================================================================

	broadcast(event, payload) {
		this.channel.send({
			type: "broadcast",
			event: event,
			payload: { ...payload, id: this.me.id }
		});
	}

	// Broadcast updated x/y mouse coordinates
	broadcastPointerMove(event) {
		const position = this.getCursorPositionSend(event.clientX, event.clientY);
		this.broadcast("cursor", { ...position, id: this.me.id });
	}

	// Broadcast x/y coordinates to null
	broadcastPointerLeave(event) {
		if (event.clientX <= this.screen.clientWidth || event.clientY <= this.screen.clientHeight) return;
		this.broadcast("cursor", { x: null, y: null, id: this.me.id });
	}

	// Broadcast mouse click
	broadcastClick(event) {
		const position = this.getCursorPositionSend(event.clientX, event.clientY);
		this.broadcast("click", position);
	}

	// =========================================================================
	// Internal utilities
	// =========================================================================

	// Normalize user's cursor position to current screen size before sending to channel
	getCursorPositionSend(x, y) {
		return {
			x: ((x - this.screen.offsetLeft) / this.screen.clientWidth).toFixed(5),
			y: ((y - this.screen.offsetTop) / this.screen.clientHeight).toFixed(5)
		};
	}

	// Scale received cursor position to our screen size
	getCursorPositionReceive(x, y) {
		return {
			x: x * this.screen.clientWidth + this.screen.offsetLeft,
			y: y * this.screen.clientHeight + this.screen.offsetTop
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
	igv = null; // IGV library
	browser = null; // IGV Browser object
	settings = IGV_DEFAULTS;
	onEvent = null;
	skipBroadcast = {};

	// Create IGV browser
	async init({ div, genome, tracks, onEvent }) {
		// Initialize
		this.onEvent = onEvent ?? ((payload) => console.log("Payload =", payload));
		this.settings.genome = genome;
		this.settings.tracks = tracks;

		// Create IGV browser (import here to avoid SSR issue)
		this.igv = (await import("igv")).default;
		this.igv.createBrowser(div, this.settings).then((browser) => {
			this.browser = browser;
			console.log("Created IGV browser", browser);

			// Listen to IGV view changes
			this.browser.on("locuschange", () => this.broadcast("locus"));
			this.browser.centerLineButton.button.addEventListener("click", () => this.broadcast("showCenterGuide"));
			this.browser.cursorGuideButton.button.addEventListener("click", () => this.broadcast("showCursorTrackingGuide"));
			this.browser.trackLabelControl.button.addEventListener("click", () => this.broadcast("showTrackLabels"));

			// TODO: Supported events: trackremoved, trackorderchanged, trackclick, trackdrag, trackdragend
		});
	}

	// Get an IGV setting. Don't use `this.get("locus")` because that might give fractional coordinates,
	// e.g. "chr17:7668882.847133762-7690031.847133762", which is broadcast to other users and causes them
	// to re-broadcast a corrected locus, which can cause infinite loops.
	get(setting) {
		if (setting === "locus") return IGV.getLocus(this.browser.referenceFrameList.map((locus) => locus.getLocusString()));
		else if (setting === "showCenterGuide") return this.browser.centerLineList[0].isVisible;
		else if (setting === "showCursorTrackingGuide") return this.browser.cursorGuide.horizontalGuide.style.display !== "none";
		else if (setting === "showTrackLabels") return this.browser.trackLabelsVisible;
	}

	// Set an IGV setting (only called when receive broadcasted message)
	async set(setting, value) {
		console.log(`Set |${setting}| = |${value}|`, this.get(setting) == value ? "NO-OP" : "");
		// If already at the value of interest, don't do anything
		if (this.get(setting) == value) return;

		// We're updating a setting because of a broadcasted message => don't send one ourselves
		this.skipBroadcast[setting] = true;

		// Update locus
		if (setting === "locus") await this.browser.search(value);
		// Cursor guides are boolean ==> click button if value doesn't match
		else if (setting === "showCenterGuide") this.browser.centerLineButton.button.click();
		else if (setting === "showCursorTrackingGuide") this.browser.cursorGuideButton.button.click();
		else if (setting === "showTrackLabels") this.browser.trackLabelControl.button.click();
	}

	// Broadcast IGV setting change
	broadcast(setting) {
		// Make sure to only broadcast the new setting if you're the one who made the change
		if (this.skipBroadcast[setting]) {
			console.log("Don't broadcast", setting);
			this.skipBroadcast[setting] = false;
			return;
		}

		this.onEvent({
			type: setting,
			[setting]: this.get(setting)
		});
	}

	// // Load tracks defined as JSON config
	// async loadTracks(tracks) {
	// 	console.log("Adding tracks:", tracks);
	// 	return await this.browser.loadTrackList(tracks);
	// }

	// // Delete tracks defined by their order
	// async deleteTracks(orders) {
	// 	console.log("Deleting tracks:", orders);
	// 	for (let order of orders) {
	// 		const track = this.browser.findTracks((t) => t.order == order).find((d) => d);
	// 		this.browser.removeTrack(track);
	// 	}
	// }

	// =========================================================================
	// Static class utilities
	// =========================================================================

	static getLocus(locus) {
		const locusStr = Array.isArray(locus) ? locus.join(" ") : locus;
		return locusStr.replace(/,/g, "");
	}
}
