/**
 * RoomManager.js
 * Owns rooms and player seats — NOT gameplay. Each room's actual game
 * (once started) is a plain GameEngine instance from ../js/engine —
 * the same code the client used in single-tab test mode.
 */

import crypto from "node:crypto";

const MAX_PLAYERS = 5;
const DISCONNECT_TIMEOUT_MS = 60_000; // seat becomes AI-controlled after this long offline
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // code -> room
  }

  _generateCode() {
    let code;
    do {
      code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostName, socketId) {
    const code = this._generateCode();
    const token = crypto.randomUUID();
    const room = {
      code,
      players: new Map(), // token -> player
      order: [token], // join order = turn/seat order
      started: false,
      engine: null,
    };
    room.players.set(token, this._makePlayer(token, hostName, socketId, true));
    this.rooms.set(code, room);
    return { room, token };
  }

  joinRoom(code, name, socketId) {
    const room = this.rooms.get(code);
    if (!room) return { error: "room-not-found" };
    if (room.started) return { error: "game-already-started" };
    if (room.order.length >= MAX_PLAYERS) return { error: "room-full" };

    const token = crypto.randomUUID();
    room.players.set(token, this._makePlayer(token, name, socketId, false));
    room.order.push(token);
    return { room, token };
  }

  _makePlayer(token, name, socketId, isHost) {
    return {
      token,
      name: name?.trim() || "Player",
      socketId,
      isHost,
      connected: true,
      isBot: false,
      disconnectTimer: null,
    };
  }

  /** Fills any empty seats (up to MAX_PLAYERS) with bots — called right before a game starts. */
  fillWithBots(room) {
    while (room.order.length < MAX_PLAYERS) {
      const token = crypto.randomUUID();
      const seatNumber = room.order.length + 1;
      const bot = this._makePlayer(token, `Bot ${seatNumber}`, null, false);
      bot.isBot = true;
      room.players.set(token, bot);
      room.order.push(token);
    }
  }

  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  /** Re-attaches a returning player's new socket to their existing seat. */
  reconnect(code, token, socketId) {
    const room = this.rooms.get(code);
    const player = room?.players.get(token);
    if (!room || !player) return { error: "seat-not-found" };
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.socketId = socketId;
    player.connected = true;
    player.disconnectTimer = null;
    return { room, player };
  }

  /** Marks a seat offline and starts the AI-takeover countdown for it. */
  markDisconnected(code, token, onTimeout) {
    const room = this.rooms.get(code);
    const player = room?.players.get(token);
    if (!room || !player) return;
    player.connected = false;
    player.disconnectTimer = setTimeout(() => {
      player.isBot = true;
      onTimeout(room, player);
    }, DISCONNECT_TIMEOUT_MS);
  }

  /** True once the caller is the room's original host. */
  isHost(room, token) {
    return room.order[0] === token;
  }

  /**
   * A player intentionally leaves. Before the game starts this frees the
   * seat entirely (and the next-in-order player becomes host automatically,
   * since isHost() just checks order[0]). Mid-game, leaving hands the seat
   * to AI immediately instead of waiting out the disconnect timeout.
   */
  leaveRoom(code, token) {
    const room = this.rooms.get(code);
    const player = room?.players.get(token);
    if (!room || !player) return { error: "seat-not-found" };
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);

    if (!room.started) {
      room.players.delete(token);
      room.order = room.order.filter((seatToken) => seatToken !== token);
      if (room.order.length === 0) this.rooms.delete(code);
    } else {
      player.connected = false;
      player.isBot = true;
      player.disconnectTimer = null;
    }
    return { room };
  }

  /** Public-safe room summary for the waiting room + in-game player list. */
  getSummary(room) {
    return {
      code: room.code,
      started: room.started,
      players: room.order.map((token) => {
        const p = room.players.get(token);
        return { token: p.token, name: p.name, isHost: p.isHost, connected: p.connected, isBot: p.isBot };
      }),
    };
  }
}
