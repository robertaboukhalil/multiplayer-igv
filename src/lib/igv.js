import { debounce } from "debounce";

const SETTING_LOCUS = "locus";
const SETTING_GENOME = "genome";
const SETTING_TRACKS = "tracks";
const SETTING_CENTER_LINE = "showCenterGuide";
const SETTING_TRACK_LABELS = "showTrackLabels";
const SETTING_SAMPLE_NAMES = "showSampleNames";
const SETTING_CURSOR_GUIDE = "showCursorTrackingGuide";
const IGV_DEFAULTS = {
	[SETTING_CENTER_LINE]: false,
	[SETTING_CURSOR_GUIDE]: false,
	[SETTING_TRACK_LABELS]: true,
	[SETTING_TRACKS]: []
};

export class IGV {
	multiplayer = null; // Multiplayer object
	igv = null; // IGV library
	browser = null; // IGV Browser object
	settings = {}; // Initial IGV settings
	skipBroadcast = {}; // Whether to skip the next broadcast

	// -------------------------------------------------------------------------
	// Initialization
	// -------------------------------------------------------------------------

	constructor({ multiplayer, div, config }) {
		this.multiplayer = multiplayer;
		this.div = div;
		this.settings = config || IGV_DEFAULTS;

		// Handle IGV-specific messages
		this.multiplayer.onAppPayload = (payload) => {
			this.set(payload.setting, payload.value, true);
		};
	}

	// Create IGV browser
	async init() {
		// Create IGV browser (import here to avoid SSR issue)
		this.igv = (await import("igv")).default;
		return this.igv.createBrowser(this.div, this.settings).then((browser) => {
			this.browser = browser;
			console.log("Created IGV browser", browser);

			// Listen to IGV events (debounce `locuschange` because it triggers 2-3 times)
			this.browser.on("locuschange", debounce(() => this.broadcast(SETTING_LOCUS), 50)); // prettier-ignore

			// Listen to button clicks
			this.browser.centerLineButton.button.addEventListener("click", () => this.broadcast(SETTING_CENTER_LINE));
			this.browser.cursorGuideButton.button.addEventListener("click", () => this.broadcast(SETTING_CURSOR_GUIDE));
			this.browser.trackLabelControl.button.addEventListener("click", () => this.broadcast(SETTING_TRACK_LABELS));
			this.browser.sampleNameControl.button.addEventListener("click", () => this.broadcast(SETTING_SAMPLE_NAMES));

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
			case SETTING_LOCUS:
				const loci = this.browser.referenceFrameList.map((locus) => locus.getLocusString());
				return loci.join(" ");
			case SETTING_GENOME:
				return this.browser.genome.id;
			case SETTING_TRACKS:
				return this.browser.findTracks();

			// UI settings
			case SETTING_CENTER_LINE:
				return this.browser.centerLineList[0].isVisible;
			case SETTING_CURSOR_GUIDE:
				return this.browser.cursorGuide.horizontalGuide.style.display !== "none";
			case SETTING_TRACK_LABELS:
				return this.browser.trackLabelsVisible;
			case SETTING_SAMPLE_NAMES:
				return this.browser.showSampleNames;

			// Unknown
			default:
				console.error("Unknown IGV setting", setting);
		}
	}

	// Set an IGV setting (usually called from broadcasted message, unless it's for a event not tracked by IGV)
	async set(setting, value, fromBroadcast = false) {
		console.log(`Set |${setting}| = |${value}|`, this.get(setting) == value ? "NO-OP" : "");
		// If already at the value of interest, don't do anything
		// e.g. cursor guides are boolean ==> click the button only if value doesn't match
		if (this.get(setting) == value) return;

		// If we're updating a setting because of a broadcasted message => don't send one ourselves
		if (fromBroadcast) {
			this.skipBroadcast[setting] = true;
		} else {
			this.broadcast(setting);
		}

		switch (setting) {
			// Main settings
			case SETTING_LOCUS:
				return await this.browser.search(value);
			case SETTING_GENOME:
				return await this.browser.loadGenome(value);
			case SETTING_TRACKS:
				return Array.isArray(value) ? this.browser.loadTrackList(value) : this.browser.loadTrack(value);

			// UI settings
			case SETTING_CENTER_LINE:
				return this.browser.centerLineButton.button.click();
			case SETTING_CURSOR_GUIDE:
				return this.browser.cursorGuideButton.button.click();
			case SETTING_TRACK_LABELS:
				return this.browser.trackLabelControl.button.click();
			case SETTING_SAMPLE_NAMES:
				return this.browser.sampleNameControl.button.click();

			// Unknown
			default:
				console.error("Unknown IGV setting", setting);
		}
	}

	// -------------------------------------------------------------------------
	// Broadcast events
	// -------------------------------------------------------------------------

	broadcast(setting) {
		// Only broadcast the new setting if you're the one who made the change
		if (this.skipBroadcast[setting]) {
			console.log("Don't broadcast", setting, this.get(setting));
			this.skipBroadcast[setting] = false;
			return;
		}

		this.multiplayer.broadcast("app", {
			setting,
			value: this.get(setting)
		});
	}

	// -------------------------------------------------------------------------
	// Utilities
	// -------------------------------------------------------------------------

	// Extend IGV's toJSON with our settings of interest
	toJSON() {
		const config = this.browser?.toJSON();
		const settings = [SETTING_CENTER_LINE, SETTING_TRACK_LABELS, SETTING_SAMPLE_NAMES, SETTING_CURSOR_GUIDE];
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

// Reference genomes (Source: https://s3.amazonaws.com/igv.org.genomes/genomes.json)
// jq '.[] | { (.id): { name: .name}}' genomes.json | jq -s '.'
export const IGV_DEFAULT_GENOME = "hg38";
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
