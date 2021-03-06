// Cloudflare Worker that handles API requests (HTTP and WebSockets).
// Uses ES module format to support Durable Objects.

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import manifestJSON from "__STATIC_CONTENT_MANIFEST";
const IGV_OPTIONS = ["locus", "genome", "showCenterGuide", "showCursorTrackingGuide"];


// =============================================================================
// Handle fetch requests
// =============================================================================

export default {
	async fetch(request, env) {
		return await handleErrors(request, async () => {
			const url = new URL(request.url);
			const path = url.pathname.slice(1).split("/");

			// API requests
			if(path[0] === "api")
				return handleApiRequest(path.slice(1), request, env);

			// Serve static assets (workaround until "kv-asset-handler" supports ES modules)
			return await getAssetFromKV({
				request,
				waitUntil: () => {}
			}, {
				ASSET_NAMESPACE: env.__STATIC_CONTENT,
				ASSET_MANIFEST: JSON.parse(manifestJSON)
			});
		});
	}
}


// =============================================================================
// IGVRoom Durable Object: 1 shared IGV document = 1 durable object
// =============================================================================

export class IGVRoom {
	constructor(controller, env) {
		this.id = controller.id;            // ID of the object (Use .toString() to convert to hex)
		this.storage = controller.storage;  // Durable storage
		this.env = env;                     // Environment bindings, e.g. KV namespaces, secrets
		this.sessions = [];                 // WebSocket sessions
	}

	// ---------------------------------------------------------------------------
	// Handle WebSocket connection requests
	// ---------------------------------------------------------------------------
	async fetch(request) {
		return await handleErrors(request, async () => {
			const url = new URL(request.url);

			switch(url.pathname) {
				case "/websocket": {
					if (request.headers.get("Upgrade") != "websocket")
						return new Response("expected websocket", {status: 400});
					let pair = new WebSocketPair();
					await this.handleSession(pair[1]);
					return new Response(null, { status: 101, webSocket: pair[0] });
				}

				// We're creating a new room and initializing settings
				case "/init": {
					const data = await request.json();
					await this.storage.put("name", data.roomName);
					await this.storage.put("time_created", new Date().getTime());
					return new Response(this.id.toString(), {status: 200});
				}

				default:
					return new Response("Not found.", {status: 404});
			}
		});
	}

	// ---------------------------------------------------------------------------
	// Handle new WebSockets connection
	// ---------------------------------------------------------------------------
	async handleSession(webSocket) {
		// -------------------------------------------------------------------------
		// Initialize connection
		// -------------------------------------------------------------------------
		webSocket.accept();

		// Create our session and add it to the sessions list.
		let session = { webSocket, blockedMessages: [] };
		this.sessions.push(session);

		// Queue "join" messages for all online users, to populate the client's roster.
		this.sessions.forEach(otherSession => {
			if(otherSession.name)
				session.blockedMessages.push(JSON.stringify({ joined: otherSession.name }));
		});

		// -------------------------------------------------------------------------
		// Get the current state (IGV options + cursors) so we can send it to a new user
		// -------------------------------------------------------------------------
		let settings = {};
		for(let setting of IGV_OPTIONS) {
			const data = await this.storage.get(setting);
			settings[setting] = data;
		}
		session.blockedMessages.push(JSON.stringify({ igvinit: settings }));
		session.blockedMessages.push(JSON.stringify({ init: {
			roomName: await this.storage.get("name"),
			timeCreated: await this.storage.get("time_created")
		}}));

		// Initialize (and cleanup) cursor positions
		let cursorsToDelete = [];
		const cursors = await this.storage.list({ prefix: "cursor:", reverse: true, limit: 20 });
		cursors.forEach((value, key) => {
			const timestamp = JSON.parse(value).timestamp;
			if(timestamp == null || new Date().getTime() - timestamp > 100000)
				cursorsToDelete.push(key);
			else
				session.blockedMessages.push(value)
		});
		await this.storage.delete(cursorsToDelete);

		// -------------------------------------------------------------------------
		// Process a WebSocket message
		// -------------------------------------------------------------------------
		let receivedUserInfo = false;
		webSocket.addEventListener("message", async msg => {
			try {
				if (session.quit)
					return webSocket.close(1011, "WebSocket broken.");
				const data = JSON.parse(msg.data);

				// ---------------------------------------------------------------------
				// First time we see this user?
				// ---------------------------------------------------------------------
				if (!receivedUserInfo) {
					session.name = "" + (data.name || "anonymous");
					if (session.name.length > 64) {
						webSocket.send(JSON.stringify({ error: "Name too long." }));
						webSocket.close(1009, "Name too long.");
						return;
					}

					// Deliver messages queued up since the user connected
					session.blockedMessages.forEach(queued => webSocket.send(queued));
					session.blockedMessages = [];

					// Broadcast that this user has joined
					this.broadcast({ joined: session.name });
					webSocket.send(JSON.stringify({ ready: true }));
					receivedUserInfo = true;
					return;
				}

				// ---------------------------------------------------------------------
				// Update IGV options, e.g. locus
				// ---------------------------------------------------------------------
				for(let setting of IGV_OPTIONS) {
					if(data[setting] != null) {
						await this.storage.put(setting, data[setting]);
						this.broadcast(data);
						return;
					}
				}

				// ---------------------------------------------------------------------
				// Update cursor position
				// ---------------------------------------------------------------------
				if(data.cursor != null) {
					let dataStr = JSON.stringify({
						name: session.name,
						timestamp: new Date().getTime(),
						...data
					});

					if(data.cursor.x === null || data.cursor.y === null) {
						await this.storage.delete(`cursor:${session.name}`);
						this.broadcast(dataStr);
						return;
					}

					// Broadcast the message to all other WebSockets
					this.broadcast(dataStr);
					await this.storage.put(`cursor:${session.name}`, dataStr);
					return;
				}

			} catch (err) {
				// Report any exceptions directly back to the client. As with our handleErrors() this
				// probably isn't what you'd want to do in production, but it's convenient when testing.
				webSocket.send(JSON.stringify({ error: err.stack }));
			}
		});

		// -------------------------------------------------------------------------
		// Handle close/error WebSocket events
		// -------------------------------------------------------------------------
		let closeOrErrorHandler = async evt => {
			session.quit = true;
			this.sessions = this.sessions.filter(member => member !== session);
			if(session.name) {
				await this.storage.delete(`cursor:${session.name}`);
				this.broadcast({ quit: session.name });
			}
		};
		webSocket.addEventListener("close", closeOrErrorHandler);
		webSocket.addEventListener("error", closeOrErrorHandler);
	}

	// ---------------------------------------------------------------------------
	// Broadcast message to all clients
	// ---------------------------------------------------------------------------
	broadcast(message) {
		if(typeof message !== "string")
			message = JSON.stringify(message);

		// Broadcast message
		let quitters = [];
		this.sessions = this.sessions.filter(session => {
			if (session.name) {
				try {
					session.webSocket.send(message);
					return true;
				} catch (err) {
					// Whoops, this connection is dead; remove it and notify everyone else
					session.quit = true;
					quitters.push(session);
					return false;
				}
			} else {
				// This session hasn't sent the initial user info message yet, so we're not sending them
				// messages yet (no secret lurking!). Queue the message to be sent later.
				session.blockedMessages.push(message);
				return true;
			}
		});

		quitters.forEach(quitter => {
			if (quitter.name)
				this.broadcast({ quit: quitter.name });
		});
	}
}


// =============================================================================
// Utilities
// =============================================================================

// Call a function and catch errors, with support for HTTP/WebSockets requests
async function handleErrors(request, func) {
	try {
		return await func();
	} catch (err) {
		if (request.headers.get("Upgrade") == "websocket") {
			let pair = new WebSocketPair();
			pair[1].accept();
			pair[1].send(JSON.stringify({ error: err.stack }));
			pair[1].close(1011, "Uncaught exception during session setup");
			return new Response(null, { status: 101, webSocket: pair[0] });
		} else {
			return new Response(err.stack, { status: 500 });
		}
	}
}

// Route API requests
async function handleApiRequest(path, request, env) {
	const endpoint = path[0];
	const name = path[1];

	switch(endpoint) {
		case "rooms": {
			let id;
			let endpoint = "websocket";

			// POST /api/rooms/
			if(request.method == "POST" && !name) {
				id = env.rooms.newUniqueId();
				endpoint = "init";
	
			// GET /api/rooms/<roomID>
			} else {
				// Each Durable Object has a 256-bit unique ID
				if(!name.match(/^[0-9a-f]{64}$/))
					return new Response("Unknown document", { status: 404 });
				id = env.rooms.idFromString(name);
			}

			// Reroute API to the durable object
			const room = env.rooms.get(id);
			const newURL = `${new URL(request.url).origin}/${endpoint}`;
			return room.fetch(newURL, request);
		}

		default:
			return new Response("Not found", { status: 404 });
	}
}
