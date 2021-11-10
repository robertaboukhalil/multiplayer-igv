import HTML from "chat.html";


/////////
function createError(message) {
  const err = new Error(message);
  err.source = "ulid";
  return err;
}
// These values should NEVER change. If
// they do, we're no longer making ulids!
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford's Base32
const ENCODING_LEN = ENCODING.length;
const TIME_MAX = Math.pow(2, 48) - 1;
const TIME_LEN = 10;
const RANDOM_LEN = 16;
export function replaceCharAt(str, index, char) {
  if (index > str.length - 1) {
      return str;
  }
  return str.substr(0, index) + char + str.substr(index + 1);
}
export function incrementBase32(str) {
  let done = undefined;
  let index = str.length;
  let char;
  let charIndex;
  const maxCharIndex = ENCODING_LEN - 1;
  while (!done && index-- >= 0) {
      char = str[index];
      charIndex = ENCODING.indexOf(char);
      if (charIndex === -1) {
          throw createError("incorrectly encoded string");
      }
      if (charIndex === maxCharIndex) {
          str = replaceCharAt(str, index, ENCODING[0]);
          continue;
      }
      done = replaceCharAt(str, index, ENCODING[charIndex + 1]);
  }
  if (typeof done === "string") {
      return done;
  }
  throw createError("cannot increment this string");
}
export function randomChar(prng) {
  let rand = Math.floor(prng() * ENCODING_LEN);
  if (rand === ENCODING_LEN) {
      rand = ENCODING_LEN - 1;
  }
  return ENCODING.charAt(rand);
}
export function encodeTime(now, len) {
  if (isNaN(now)) {
      throw new Error(now + " must be a number");
  }
  if (now > TIME_MAX) {
      throw createError("cannot encode time greater than " + TIME_MAX);
  }
  if (now < 0) {
      throw createError("time must be positive");
  }
  if (Number.isInteger(now) === false) {
      throw createError("time must be an integer");
  }
  let mod;
  let str = "";
  for (; len > 0; len--) {
      mod = now % ENCODING_LEN;
      str = ENCODING.charAt(mod) + str;
      now = (now - mod) / ENCODING_LEN;
  }
  return str;
}
export function encodeRandom(len, prng) {
  let str = "";
  for (; len > 0; len--) {
      str = randomChar(prng) + str;
  }
  return str;
}
export function decodeTime(id) {
  if (id.length !== TIME_LEN + RANDOM_LEN) {
      throw createError("malformed ulid");
  }
  var time = id
      .substr(0, TIME_LEN)
      .split("")
      .reverse()
      .reduce((carry, char, index) => {
      const encodingIndex = ENCODING.indexOf(char);
      if (encodingIndex === -1) {
          throw createError("invalid character found: " + char);
      }
      return (carry += encodingIndex * Math.pow(ENCODING_LEN, index));
  }, 0);
  if (time > TIME_MAX) {
      throw createError("malformed ulid, timestamp too large");
  }
  return time;
}
export function detectPrng(allowInsecure = true, root) {
  if (!root) {
      root = typeof window !== "undefined" ? window : null;
  }
  const browserCrypto = root && (root.crypto || root.msCrypto);
  if (browserCrypto) {
      return () => {
          const buffer = new Uint8Array(1);
          browserCrypto.getRandomValues(buffer);
          return buffer[0] / 0xff;
      };
  }
  else {
      try {
          const nodeCrypto = require("crypto");
          return () => nodeCrypto.randomBytes(1).readUInt8() / 0xff;
      }
      catch (e) { }
  }
  if (allowInsecure) {
      try {
          console.error("secure crypto unusable, falling back to insecure Math.random()!");
      }
      catch (e) { }
      return () => Math.random();
  }
  throw createError("secure crypto unusable, insecure Math.random not allowed");
}
export function factory(currPrng) {
  if (!currPrng) {
      currPrng = detectPrng();
  }
  return function ulid(seedTime) {
      if (isNaN(seedTime)) {
          seedTime = Date.now();
      }
      return encodeTime(seedTime, TIME_LEN) + encodeRandom(RANDOM_LEN, currPrng);
  };
}
export function monotonicFactory(currPrng) {
  if (!currPrng) {
      currPrng = detectPrng();
  }
  let lastTime = 0;
  let lastRandom;
  return function ulid(seedTime) {
      if (isNaN(seedTime)) {
          seedTime = Date.now();
      }
      if (seedTime <= lastTime) {
          const incrementedRandom = (lastRandom = incrementBase32(lastRandom));
          return encodeTime(lastTime, TIME_LEN) + incrementedRandom;
      }
      lastTime = seedTime;
      const newRandom = (lastRandom = encodeRandom(RANDOM_LEN, currPrng));
      return encodeTime(seedTime, TIME_LEN) + newRandom;
  };
}
export const ulid = factory();
/////////




async function handleErrors(request, func) {
  try {
    return await func();
  } catch (err) {
    if (request.headers.get("Upgrade") == "websocket") {
      // Annoyingly, if we return an HTTP error in response to a WebSocket request, Chrome devtools
      // won't show us the response body! So... let's send a WebSocket response with an error
      // frame instead.
      let pair = new WebSocketPair();
      pair[1].accept();
      pair[1].send(JSON.stringify({error: err.stack}));
      pair[1].close(1011, "Uncaught exception during session setup");
      return new Response(null, { status: 101, webSocket: pair[0] });
    } else {
      return new Response(err.stack, {status: 500});
    }
  }
}

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


async function handleApiRequest(path, request, env) {
  // We've received at API request. Route the request based on the path.

  switch (path[0]) {
    case "room": {
      // Request for `/api/room/...`.

      if (!path[1]) {
        // The request is for just "/api/room", with no ID.
        // if (request.method == "POST") {
        //   // POST to /api/room creates a private room.
        //   let id = env.rooms.newUniqueId();
        //   return new Response(id.toString(), {headers: {"Access-Control-Allow-Origin": "*"}});
        // } else {
        //   // List rooms
          return new Response("Method not allowed", {status: 405});
        // }
      }

      // OK, the request is for `/api/room/<name>/...`. It's time to route to the Durable Object
      // for the specific room.
      let name = path[1];
      name = "test";  // FIXME: for now, only 1 document called "test"

      // Each Durable Object has a 256-bit unique ID. IDs can be derived from string names, or
      // chosen randomly by the system.
      let id;
      if (name.match(/^[0-9a-f]{64}$/)) {
        id = env.rooms.idFromString(name);
      } else if (name.length <= 32) {
        id = env.rooms.idFromName(name);
      } else {
        return new Response("Name too long", {status: 404});
      }

      // Get the Durable Object stub for this room!
      let roomObject = env.rooms.get(id);
      let newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");
      return roomObject.fetch(newUrl, request);
    }

    default:
      return new Response("Not found", {status: 404});
  }
}

// =======================================================================================
// The ChatRoom Durable Object Class

// ChatRoom implements a Durable Object that coordinates an individual chat room. Participants
// connect to the room using WebSockets, and the room broadcasts messages from each participant
// to all others.
export class ChatRoom {
  constructor(controller, env) {
    this.storage = controller.storage;  // Durable storage
    this.env = env;                     // Environment bindings, e.g. KV namespaces, secrets
    this.sessions = [];                 // WebSocket sessions
    this.locus = "chr3:1000000-1100000";// Genomic region // TODO:
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

    // Set event handlers to receive messages.
    let receivedUserInfo = false;
    webSocket.addEventListener("message", async msg => {
      try {
        if (session.quit) {
          webSocket.close(1011, "WebSocket broken.");
          return;
        }

        // I guess we'll use JSON.
        let data = JSON.parse(msg.data);

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
          delete session.blockedMessages;

          // Broadcast to all other connections that this user has joined.
          this.broadcast({joined: session.name});
          webSocket.send(JSON.stringify({ready: true}));

      // // TODO: Clean up old users
      // TODO: use timestamp value, not from ULID...
      let storage = await this.storage.list({ start: "cursor:", reverse: true, limit: 100 });
      let users = [...storage.keys()];
      let toDelete = [];
      for(let user of users) {
        try {
          if(new Date() - new Date(decodeTime(user.split(":")[1])) > 100000)
            toDelete.push(user);
        } catch (error) {
            toDelete.push(user);
        }
      }
      // webSocket.send(JSON.stringify({error: toDelete}));
      if(toDelete.length > 0)
        await this.storage.delete(toDelete);



          // Note that we've now received the user info message.
          receivedUserInfo = true;

          return;
        }

        if(data.cursor != null) {
          let dataStr = JSON.stringify({
            name: session.name,
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
          return
        }

        // // Construct sanitized message for storage and broadcast.
        // data = { name: session.name, message: "" + data.message };

        // // Block people from sending overly long messages. This is also enforced on the client,
        // // so to trigger this the user must be bypassing the client code.
        // if (data.message.length > 256) {
        //   webSocket.send(JSON.stringify({error: "Message too long."}));
        //   return;
        // }

        // // Add timestamp. Here's where this.lastTimestamp comes in -- if we receive a bunch of
        // // messages at the same time (or if the clock somehow goes backwards????), we'll assign
        // // them sequential timestamps, so at least the ordering is maintained.
        // data.timestamp = Math.max(Date.now(), this.lastTimestamp + 1);
        // this.lastTimestamp = data.timestamp;

        // // Broadcast the message to all other WebSockets.
        // let dataStr = JSON.stringify(data);
        // this.broadcast(dataStr);

        // // Save message.
        // let key = new Date(data.timestamp).toISOString();
        // await this.storage.put(`message:${key}`, dataStr);
      } catch (err) {
        // Report any exceptions directly back to the client. As with our handleErrors() this
        // probably isn't what you'd want to do in production, but it's convenient when testing.
        webSocket.send(JSON.stringify({error: err.stack}));
      }
    });

    // On "close" and "error" events, remove the WebSocket from the sessions list and broadcast
    let closeOrErrorHandler = async evt => {
      session.quit = true;
      this.sessions = this.sessions.filter(member => member !== session);
      if (session.name) {
        await this.storage.delete(`cursor:${session.name}`);
        this.broadcast({quit: session.name});
      }
    };
    webSocket.addEventListener("close", closeOrErrorHandler);
    webSocket.addEventListener("error", closeOrErrorHandler);
  }

  // broadcast() broadcasts a message to all clients.
  broadcast(message) {
    // Apply JSON if we weren't given a string to start with.
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

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
      if (quitter.name) {
        this.broadcast({quit: quitter.name});
      }
    });
  }
}
