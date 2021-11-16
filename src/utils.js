import hash from "string-hash";

// Generate a color from a user ID
export function getColor(user) {
	// Source: Cyclical/Rainbow: https://observablehq.com/@d3/color-schemes?collection=@d3/d3-scale-chromatic
	const colors = ["#6e40aa","#bf3caf","#fe4b83","#ff7847","#e2b72f","#aff05b","#52f667","#1ddfa3","#23abd8","#4c6edb","#6e40aa"];
	return colors[Math.abs(hash(user)) % colors.length];
}
