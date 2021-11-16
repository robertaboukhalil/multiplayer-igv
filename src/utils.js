import hash from "string-hash";
import { schemeCategory10 } from "d3-scale-chromatic";

// Generate a color from a user ID
export function getColor(user) {
	return schemeCategory10[Math.abs(hash(user)) % schemeCategory10.length];
}
