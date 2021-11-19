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

// TODO: add more
// Reference genomes (Source: https://s3.amazonaws.com/igv.org.genomes/genomes.json)
export const GENOMES = {
	"hg19": { "name": "Human (GRCh37/hg19)" },
	"hg38": { "name": "Human (GRCh38/hg38)" },
	"mm39": { "name": "Mouse (GRCm39/mm39)" }
};
