import HTML from "chat.html";


// =============================================================================
// 
// =============================================================================

export default {
	async fetch(request, env) {
		return await handleErrors(request, async () => {
			// We have received an HTTP request! Parse the URL and route the request.

			let url = new URL(request.url);
			let path = url.pathname.slice(1).split('/');

			if (!path[0]) {
				// Serve our HTML at the root path.
				return new Response(HTML, {headers: {"Content-Type": "text/html;charset=UTF-8"}});
			}

			switch (path[0]) {
				case "api":
					// This is a request for `/api/...`, call the API handler.
					return handleApiRequest(path.slice(1), request, env);

				default:
					return new Response("Not found", {status: 404});
			}
		});
	}
}



// =======================================================================================
// The ChatRoom Durable Object Class

// ChatRoom implements a Durable Object that coordinates an individual chat room. Participants
// connect to the room using WebSockets, and the room broadcasts messages from each participant
// to all others.
export class IGVRoom {
	constructor(controller, env) {
		this.storage = controller.storage;  // Durable storage
		this.env = env;                     // Environment bindings, e.g. KV namespaces, secrets
		this.sessions = [];                 // WebSocket sessions
	}

	async fetch(request) {
		return await handleErrors(request, async () => {
			let url = new URL(request.url);

			switch (url.pathname) {
				case "/websocket": {
					// The request is to `/api/room/<name>/websocket`. A client is trying to establish a new WebSocket session.
					if (request.headers.get("Upgrade") != "websocket")
						return new Response("expected websocket", {status: 400});
					let pair = new WebSocketPair();
					await this.handleSession(pair[1]);
					return new Response(null, { status: 101, webSocket: pair[0] });
				}

				default:
					return new Response("Not found", {status: 404});
			}
		});
	}

	// handleSession() implements our WebSocket-based chat protocol.
	async handleSession(webSocket) {
		webSocket.accept();

		// Create our session and add it to the sessions list.
		let session = {webSocket, blockedMessages: []};
		this.sessions.push(session);

		// Queue "join" messages for all online users, to populate the client's roster.
		this.sessions.forEach(otherSession => {
			if (otherSession.name) {
				session.blockedMessages.push(JSON.stringify({joined: otherSession.name}));
			}
		});

		// TODO:
		let storage = await this.storage.list({ start: "cursor:", reverse: true, limit: 100 });
		let backlog = [...storage.values()];
		backlog.reverse();
		backlog.forEach(value => {
			session.blockedMessages.push(value);
		});
		session.blockedMessages.push(JSON.stringify({
			locus: await this.storage.get("locus")
		}));

		// Set event handlers to receive messages.
		let receivedUserInfo = false;
		webSocket.addEventListener("message", async msg => {
			try {
				if (session.quit) {
					webSocket.close(1011, "WebSocket broken.");
					return;
				}

				let data = JSON.parse(msg.data);

				// Get user info
				if (!receivedUserInfo) {
					// The first message the client sends is the user info message with their name. Save it
					// into their session object.
					session.name = "" + (data.name || "anonymous");

					// Don't let people use ridiculously long names. (This is also enforced on the client,
					// so if they get here they are not using the intended client.)
					if (session.name.length > 64) {
						webSocket.send(JSON.stringify({error: "Name too long."}));
						webSocket.close(1009, "Name too long.");
						return;
					}

					// Deliver all the messages we queued up since the user connected.
					session.blockedMessages.forEach(queued => {
						webSocket.send(queued);
					});
					session.blockedMessages = [];

					// Broadcast to all other connections that this user has joined.
					this.broadcast({joined: session.name});
					webSocket.send(JSON.stringify({ready: true}));

					// Clean up old users
					let storage = await this.storage.list({ start: "cursor:", limit: 20 });
					let keys = [...storage.keys()];
					let keysToDelete = [];
					for(let key of keys) {
						if(storage.get(key).timestamp == null || new Date().getTime() - storage.get(key).timestamp > 100000)
							keysToDelete.push(key);
					}
					await this.storage.delete(keysToDelete);

					// Note that we've now received the user info message.
					receivedUserInfo = true;
					return;
				}

				// Get updated cursor position
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
					
					// Broadcast the message to all other WebSockets.
					this.broadcast(dataStr);
					await this.storage.put(`cursor:${session.name}`, dataStr);
					return;
				}

				// Get updated locus
				if(data.locus != null) {
					await this.storage.put("locus", data.locus);
					this.broadcast(data);
					return;
				}
			} catch (err) {
				// Report any exceptions directly back to the client. As with our handleErrors() this
				// probably isn't what you'd want to do in production, but it's convenient when testing.
				webSocket.send(JSON.stringify({ error: err.stack }));
			}
		});

		// On "close" and "error" events, remove the WebSocket from the sessions list and broadcast
		let closeOrErrorHandler = async evt => {
			session.quit = true;
			this.sessions = this.sessions.filter(member => member !== session);
			if (session.name) {
				await this.storage.delete(`cursor:${session.name}`);
				this.broadcast({ quit: session.name });
			}
		};
		webSocket.addEventListener("close", closeOrErrorHandler);
		webSocket.addEventListener("error", closeOrErrorHandler);
	}

	// broadcast() broadcasts a message to all clients.
	broadcast(message) {
		// Apply JSON if we weren't given a string to start with.
		if (typeof message !== "string")
			message = JSON.stringify(message);

		// Iterate over all the sessions sending them messages.
		let quitters = [];
		this.sessions = this.sessions.filter(session => {
			if (session.name) {
				try {
					session.webSocket.send(message);
					return true;
				} catch (err) {
					// Whoops, this connection is dead. Remove it from the list and arrange to notify
					// everyone below.
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
	const name = "test";  // path[1];  // FIXME: hardcoded for now

	switch(endpoint) {
		case "room": {
			// // TODO: POST /api/room
			// if(!path[1] && request.method == "POST") {
			// 	const id = env.rooms.newUniqueId();
			// 	return new Response(id.toString(), { headers: { "Access-Control-Allow-Origin": "*" }});
			// }

			// Each Durable Object has a 256-bit unique ID, derived or randomly generated
			let id;
			if (name.match(/^[0-9a-f]{64}$/))
				id = env.rooms.idFromString(name);
			else if (name.length <= 32)
				id = env.rooms.idFromName(name);
			else
				return new Response("Name too long", {status: 404});

			// Get the Durable Object stub for this room!
			let roomObject = env.rooms.get(id);
			let newUrl = new URL(request.url);
			newUrl.pathname = "/" + path.slice(2).join("/");
			return roomObject.fetch(newUrl, request);
		}

		default:
			return new Response("Not found", { status: 404 });
	}
}
