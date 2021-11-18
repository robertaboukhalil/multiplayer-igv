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

// Reference genomes (Source: https://s3.amazonaws.com/igv.org.genomes/genomes.json)
export const GENOMES = {
	"hg19": {
		"name": "Human (GRCh37/hg19)",
		"fastaURL": "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg19/hg19.fasta",
		"cytobandURL": "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg19/cytoBand.txt",
	},
	"hg38": {
		"name": "Human (GRCh38/hg38)",
		"fastaURL": "https://s3.amazonaws.com/igv.broadinstitute.org/genomes/seq/hg38/hg38.fa",
		"cytobandURL": "https://s3.amazonaws.com/igv.org.genomes/hg38/annotations/cytoBandIdeo.txt.gz",
	},
	"mm39": {
		"name": "Mouse (GRCm39/mm39)",
		"fastaURL": "https://s3.amazonaws.com/igv.org.genomes/mm39/mm39.fa",
		"cytobandURL": "https://hgdownload.soe.ucsc.edu/goldenPath/mm39/database/cytoBandIdeo.txt.gz",
	}
};

// Default IGV options
export const IGV_OPTIONS = {
	reference: GENOMES.hg19,
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
		},
		height: 600
	}]
};
