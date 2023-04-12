import hash from "string-hash";
import { nanoid } from "nanoid";
import { debounce } from "debounce";

// =============================================================================
// Multiplayer class
// =============================================================================

const SUPABASE_REALTIME_STATUS_SUBSCRIBED = "SUBSCRIBED";

export class Multiplayer {
	usersOnline = {}; // Users that are still connected, e.g. {"uuid": {"name": "bla"}}
	usersCursors = {}; // All cursor positions
	constructor(params) {
		// Set up params
		this.client = params.client;
		this.screen = params.screen;
		this.onUpdateUsers = params.onUpdateUsers;
		this.onUpdateCursors = params.onUpdateCursors;
		this.onClick = params.onClick;
		this.onPayload = params.onPayload;
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
				name: this.me.name,
				time_joined: Date.now()
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
		this.usersCursors[payload.id] = this.getCursorPositionReceive(payload.x, payload.y);
		this.onUpdateCursors(this.usersCursors);
	}

	onSupabaseBroadcastClick({ payload }) {
		this.onSupabaseBroadcastCursor({ payload });
		this.onClick(this.usersCursors[payload.id]);
		setTimeout(() => this.onClick(false), 300);
	}

	onSupabaseBroadcastAppEvent({ payload }) {
		this.onPayload(payload);
	}

	// =========================================================================
	// Broadcast events
	// =========================================================================

	broadcast(event, payload) {
		this.channel
			.send({
				type: "broadcast",
				event: event,
				payload: { ...payload, id: this.me.id }
			})
			.then((d) => {
				if (d !== "ok") {
					console.warn("Broadcast error:", d);
				}
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
		// Source: Rainbow: https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
		// prettier-ignore
		const colors = ["#6e40aa","#7140ab","#743fac","#773fad","#7a3fae","#7d3faf","#803eb0","#833eb0","#873eb1","#8a3eb2","#8d3eb2","#903db2","#943db3","#973db3","#9a3db3","#9d3db3","#a13db3","#a43db3","#a73cb3","#aa3cb2","#ae3cb2","#b13cb2","#b43cb1","#b73cb0","#ba3cb0","#be3caf","#c13dae","#c43dad","#c73dac","#ca3dab","#cd3daa","#d03ea9","#d33ea7","#d53ea6","#d83fa4","#db3fa3","#de3fa1","#e040a0","#e3409e","#e5419c","#e8429a","#ea4298","#ed4396","#ef4494","#f14592","#f34590","#f5468e","#f7478c","#f9488a","#fb4987","#fd4a85","#fe4b83","#ff4d80","#ff4e7e","#ff4f7b","#ff5079","#ff5276","#ff5374","#ff5572","#ff566f","#ff586d","#ff596a","#ff5b68","#ff5d65","#ff5e63","#ff6060","#ff625e","#ff645b","#ff6659","#ff6857","#ff6a54","#ff6c52","#ff6e50","#ff704e","#ff724c","#ff744a","#ff7648","#ff7946","#ff7b44","#ff7d42","#ff8040","#ff823e","#ff843d","#ff873b","#ff893a","#ff8c38","#ff8e37","#fe9136","#fd9334","#fb9633","#f99832","#f89b32","#f69d31","#f4a030","#f2a32f","#f0a52f","#eea82f","#ecaa2e","#eaad2e","#e8b02e","#e6b22e","#e4b52e","#e2b72f","#e0ba2f","#debc30","#dbbf30","#d9c131","#d7c432","#d5c633","#d3c934","#d1cb35","#cece36","#ccd038","#cad239","#c8d53b","#c6d73c","#c4d93e","#c2db40","#c0dd42","#bee044","#bce247","#bae449","#b8e64b","#b6e84e","#b5ea51","#b3eb53","#b1ed56","#b0ef59","#adf05a","#aaf159","#a6f159","#a2f258","#9ef258","#9af357","#96f357","#93f457","#8ff457","#8bf457","#87f557","#83f557","#80f558","#7cf658","#78f659","#74f65a","#71f65b","#6df65c","#6af75d","#66f75e","#63f75f","#5ff761","#5cf662","#59f664","#55f665","#52f667","#4ff669","#4cf56a","#49f56c","#46f46e","#43f470","#41f373","#3ef375","#3bf277","#39f279","#37f17c","#34f07e","#32ef80","#30ee83","#2eed85","#2cec88","#2aeb8a","#28ea8d","#27e98f","#25e892","#24e795","#22e597","#21e49a","#20e29d","#1fe19f","#1edfa2","#1ddea4","#1cdca7","#1bdbaa","#1bd9ac","#1ad7af","#1ad5b1","#1ad4b4","#19d2b6","#19d0b8","#19cebb","#19ccbd","#19cabf","#1ac8c1","#1ac6c4","#1ac4c6","#1bc2c8","#1bbfca","#1cbdcc","#1dbbcd","#1db9cf","#1eb6d1","#1fb4d2","#20b2d4","#21afd5","#22add7","#23abd8","#25a8d9","#26a6db","#27a4dc","#29a1dd","#2a9fdd","#2b9cde","#2d9adf","#2e98e0","#3095e0","#3293e1","#3390e1","#358ee1","#378ce1","#3889e1","#3a87e1","#3c84e1","#3d82e1","#3f80e1","#417de0","#437be0","#4479df","#4676df","#4874de","#4a72dd","#4b70dc","#4d6ddb","#4f6bda","#5169d9","#5267d7","#5465d6","#5663d5","#5761d3","#595fd1","#5a5dd0","#5c5bce","#5d59cc","#5f57ca","#6055c8","#6153c6","#6351c4","#6450c2","#654ec0","#664cbe","#674abb","#6849b9","#6a47b7","#6a46b4","#6b44b2","#6c43af","#6d41ad","#6e40aa"]
		return colors[Math.abs(hash(str)) % colors.length];
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
	multiplayer = null; // Multiplayer object
	igv = null; // IGV library
	browser = null; // IGV Browser object
	settings = IGV_DEFAULTS;
	skipBroadcast = {};

	constructor({ multiplayer, div, config }) {
		this.multiplayer = multiplayer;
		this.div = div;
		this.settings = config || IGV_DEFAULTS;
	}

	// Create IGV browser
	async init() {
		// Create IGV browser (import here to avoid SSR issue)
		this.igv = (await import("igv")).default;
		this.igv.createBrowser(this.div, this.settings).then((browser) => {
			this.browser = browser;
			console.log("Created IGV browser", browser);

			// Listen to changes to IGV settings (debounce `locuschange` because it triggers 2-3 times)
			const onLocusChange = debounce(() => this.broadcastSetting("locus"), 50);
			this.browser.on("locuschange", onLocusChange);
			this.browser.centerLineButton.button.addEventListener("click", () => this.broadcastSetting("showCenterGuide"));
			this.browser.cursorGuideButton.button.addEventListener("click", () => this.broadcastSetting("showCursorTrackingGuide"));
			this.browser.trackLabelControl.button.addEventListener("click", () => this.broadcastSetting("showTrackLabels"));
			this.browser.sampleNameControl.button.addEventListener("click", () => this.broadcastSetting("showSampleNames"));

			// TODO: Supported events: trackremoved, trackorderchanged, trackclick, trackdrag, trackdragend
		});
	}

	// Get an IGV setting. Don't use `this.get("locus")` because that might give fractional coordinates,
	// e.g. "chr17:7668882.847133762-7690031.847133762", which is broadcast to other users and causes them
	// to re-broadcast a corrected locus, which can cause infinite loops.
	get(setting) {
		if (setting === "locus") {
			const loci = this.browser.referenceFrameList.map((locus) => locus.getLocusString());
			return loci.join(" ");
		} else if (setting === "showCenterGuide") {
			return this.browser.centerLineList[0].isVisible;
		} else if (setting === "showCursorTrackingGuide") {
			return this.browser.cursorGuide.horizontalGuide.style.display !== "none";
		} else if (setting === "showTrackLabels") {
			return this.browser.trackLabelsVisible;
		} else if (setting === "showSampleNames") {
			return this.browser.showSampleNames;
		}
	}

	// Set an IGV setting (only called when receive broadcasted message)
	async set(setting, value) {
		console.log(`Set |${setting}| = |${value}|`, this.get(setting) == value ? "NO-OP" : "");
		// If already at the value of interest, don't do anything
		// e.g. cursor guides are boolean ==> click the button only if value doesn't match
		if (this.get(setting) == value) return;

		// We're updating a setting because of a broadcasted message => don't send one ourselves
		this.skipBroadcast[setting] = true;

		// Update setting
		if (setting === "locus") {
			await this.browser.search(value);
		} else if (setting === "showCenterGuide") {
			this.browser.centerLineButton.button.click();
		} else if (setting === "showCursorTrackingGuide") {
			this.browser.cursorGuideButton.button.click();
		} else if (setting === "showTrackLabels") {
			this.browser.trackLabelControl.button.click();
		} else if (setting === "showSampleNames") {
			this.browser.sampleNameControl.button.click();
		}
	}

	// Process an action
	process(action, value) {
		if (action === "track-add") {
			this.browser.loadTrack(value);
		}
	}

	// Broadcast setting change
	broadcastSetting(setting) {
		// Only broadcast the new setting if you're the one who made the change
		if (this.skipBroadcast[setting]) {
			console.log("Don't broadcast", setting, this.get(setting));
			this.skipBroadcast[setting] = false;
			return;
		}

		this.multiplayer.broadcast("app", {
			type: "setting",
			setting: setting,
			value: this.get(setting)
		});
	}

	// Broadcast action
	broadcastAction(action, value) {
		this.multiplayer.broadcast("app", {
			type: "action",
			action,
			value
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
}
