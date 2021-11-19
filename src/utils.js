import hash from "string-hash";

// =============================================================================
// Utilities
// =============================================================================

// Generate a color from a user ID
export function getColor(user) {
	// Source: Cyclical/Rainbow: https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
	const colors = ["#6e40aa","#bf3caf","#fe4b83","#ff7847","#e2b72f","#aff05b","#52f667","#1ddfa3","#23abd8","#4c6edb","#6e40aa"];
	return colors[Math.abs(hash(user)) % colors.length];
}

// Copy to clipboard: https://komsciguy.com/js/a-better-way-to-copy-text-to-clipboard-in-javascript/
export function copyToClipboard(text, callback) {
	const listener = function(ev) {
		ev.preventDefault();
		ev.clipboardData.setData("text/plain", text);
	};
	document.addEventListener("copy", listener);
	document.execCommand("copy");
	document.removeEventListener("copy", listener);
	callback();
}


// =============================================================================
// Configs
// =============================================================================

// Default IGV options
export const IGV_DEFAULTS = {
	genome: "hg19",
	locus: "8:128,750,948-128,751,025",
	showCenterGuide: true,
	tracks: [{
		type: "alignment",
		format: "cram",
		url: "https://s3.amazonaws.com/1000genomes/phase3/data/HG00096/exome_alignment/HG00096.mapped.ILLUMINA.bwa.GBR.exome.20120522.bam.cram",
		indexURL: "https://s3.amazonaws.com/1000genomes/phase3/data/HG00096/exome_alignment/HG00096.mapped.ILLUMINA.bwa.GBR.exome.20120522.bam.cram.crai",
		name: "HG00096",
		displayMode: "SQUISHED",
		sort: {
			chr: "chr8",
			position: 128750986,
			option: "BASE",
			direction: "ASC"
		}
	}]
};

// Reference genomes (Source: https://s3.amazonaws.com/igv.org.genomes/genomes.json)
// jq '.[] | { (.id): { name: .name}}' genomes.json | jq -s '.'
export const GENOMES = {
	"hg38": { "name": "Human (GRCh38/hg38)" },
	"hg19": { "name": "Human (GRCh37/hg19)" },
	"mm39": { "name": "Mouse (GRCm39/mm39)" },
	"rn7": { "name": "Rat (rn7)" },
	"panTro6": { "name": "Chimp (panTro6) (panTro6)" },
	"bosTau9": { "name": "Cow (ARS-UCD1.2/bosTau9)" },
	"susScr11": { "name": "Pig (SGSC Sscrofa11.1/susScr11)" },
	"galGal6": { "name": " Chicken (galGal6)" },
	"danRer11": { "name": "Zebrafish (GRCZ11/danRer11)" },
	"dm6": { "name": "D. melanogaster (dm6)" },
	"ASM985889v3": { "name": "Sars-CoV-2 (ASM985889v3)" }
};
