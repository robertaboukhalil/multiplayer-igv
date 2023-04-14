import { debounce } from "debounce";

const IGV_LOCUS = "locus";
const IGV_CENTER_LINE = "showCenterGuide";
const IGV_TRACK_LABELS = "showTrackLabels";
const IGV_SAMPLE_NAMES = "showSampleNames";
const IGV_CURSOR_GUIDE = "showCursorTrackingGuide";
const IGV_DEFAULTS = {
	[IGV_CENTER_LINE]: false,
	[IGV_CURSOR_GUIDE]: false,
	[IGV_TRACK_LABELS]: true,
	tracks: []
};
// Reference genomes (Source: https://s3.amazonaws.com/igv.org.genomes/genomes.json)
// jq '.[] | { (.id): { name: .name}}' genomes.json | jq -s '.'
export const IGV_GENOMES = {
	hg38: { name: "Human: GRCh38 (hg38)" },
	hg19: { name: "Human: GRCh37 (hg19)" },
	"chm13v2.0": { name: "Human: T2T CHM13 v2.0" },
	"chm13v1.1": { name: "Human: T2T CHM13 v1.1" },
	mm39: { name: "Mouse: GRCm39/mm39" },
	rn7: { name: "Rat: rn7" },
	panTro6: { name: "Chimp: panTro6" },
	bosTau9: { name: "Cow: bosTau9" },
	susScr11: { name: "Pig: susScr11" },
	galGal6: { name: " Chicken: galGal6" },
	danRer11: { name: "Zebrafish: danRer11" },
	dm6: { name: "D. melanogaster: dm6" },
	ce11: { name: "C. elegans: ce11" },
	sacCer3: { name: "S. cerevisiae: sacCer3" },
	ASM294v2: { name: "S. pombe: ASM294v2" },
	ASM985889v3: { name: "Sars-CoV-2: ASM985889v3)" },
	tair10: { name: "A. thaliana: TAIR 10" }
};

export class IGV {
	multiplayer = null; // Multiplayer object
	igv = null; // IGV library
	browser = null; // IGV Browser object
	settings = IGV_DEFAULTS;
	skipBroadcast = {};

	// -------------------------------------------------------------------------
	// Initialization
	// -------------------------------------------------------------------------

	constructor({ multiplayer, div, config }) {
		this.multiplayer = multiplayer;
		this.div = div;
		this.settings = config || IGV_DEFAULTS;
	}

	// Create IGV browser
	async init() {
		// Create IGV browser (import here to avoid SSR issue)
		this.igv = (await import("igv")).default;
		return this.igv.createBrowser(this.div, this.settings).then((browser) => {
			this.browser = browser;
			console.log("Created IGV browser", browser);

			// Listen to changes to IGV settings (debounce `locuschange` because it triggers 2-3 times)
			const onLocusChange = debounce(() => this.broadcastSetting(IGV_LOCUS), 50);
			this.browser.on("locuschange", onLocusChange);
			this.browser.centerLineButton.button.addEventListener("click", () => this.broadcastSetting(IGV_CENTER_LINE));
			this.browser.cursorGuideButton.button.addEventListener("click", () => this.broadcastSetting(IGV_CURSOR_GUIDE));
			this.browser.trackLabelControl.button.addEventListener("click", () => this.broadcastSetting(IGV_TRACK_LABELS));
			this.browser.sampleNameControl.button.addEventListener("click", () => this.broadcastSetting(IGV_SAMPLE_NAMES));

			// TODO: Supported events: trackremoved, trackorderchanged, trackclick, trackdrag, trackdragend
		});
	}

	// -------------------------------------------------------------------------
	// Get/set IGV settings
	// -------------------------------------------------------------------------

	// Get an IGV setting. Don't use `browser.currentLoci` because that might give fractional coordinates,
	// e.g. "chr17:7668882.847133762-7690031.847133762", which is broadcast to other users and causes them
	// to re-broadcast a corrected locus, which can cause infinite loops.
	get(setting) {
		switch (setting) {
			// Main settings
			case IGV_LOCUS:
				const loci = this.browser.referenceFrameList.map((locus) => locus.getLocusString());
				return loci.join(" ");
			case "genome":
				return;
			case "tracks":
				return this.browser.findTracks();
			// UI settings
			case IGV_CENTER_LINE:
				return this.browser.centerLineList[0].isVisible;
			case IGV_CURSOR_GUIDE:
				return this.browser.cursorGuide.horizontalGuide.style.display !== "none";
			case IGV_TRACK_LABELS:
				return this.browser.trackLabelsVisible;
			case IGV_SAMPLE_NAMES:
				return this.browser.showSampleNames;
			default:
				console.error("Unknown IGV setting", setting);
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
		if (setting === IGV_LOCUS) {
			await this.browser.search(value);
		} else if (setting === IGV_CENTER_LINE) {
			this.browser.centerLineButton.button.click();
		} else if (setting === IGV_CURSOR_GUIDE) {
			this.browser.cursorGuideButton.button.click();
		} else if (setting === IGV_TRACK_LABELS) {
			this.browser.trackLabelControl.button.click();
		} else if (setting === IGV_SAMPLE_NAMES) {
			this.browser.sampleNameControl.button.click();
		}
	}

	// Process an action
	process(action, value) {
		if (action === "track-add") {
			this.browser.loadTrack(value);
		}
	}

	// -------------------------------------------------------------------------
	// Broadcast events
	// -------------------------------------------------------------------------

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

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	// Extend IGV's toJSON with our settings of interest
	toJSON() {
		const config = this.browser?.toJSON();
		const settings = [IGV_CENTER_LINE, IGV_TRACK_LABELS, IGV_SAMPLE_NAMES, IGV_CURSOR_GUIDE];
		settings.forEach((setting) => (config[setting] = this.get(setting)));

		return config;
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
