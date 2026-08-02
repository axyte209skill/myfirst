/**
 * socketHandlers.js
 * The only place client messages turn into game actions. Every event
 * re-validates against the server's own GameEngine — a client can ask
 * for a move, but only the server's engine decides whether it happens.
 */

import { GameEngine } from "../js/engine/GameEngine.js";
import { broadcastState } from "./gameSync.js";
import { pickBotAction } from "./BotAI.js";

const MIN_PLAYERS = 1;

export function registerSocketHandlers(io, socket, rooms) {
  let currentCode = null;
  let currentToken = null;

  function fail(reason) {
    socket.emit("room:error", { reason });
  }

  socket.on("room:create", ({ name }) => {
    const { room, token } = rooms.createRoom(name, socket.id);
    currentCode = room.code;
    currentToken = token;
    socket.join(room.code);
    socket.emit("room:joined", { code: room.code, token });
    broadcastState(io, room);
  });

  socket.on("room:join", ({ code, name }) => {
    const result = rooms.joinRoom(code?.toUpperCase(), name, socket.id);
    if (result.error) return fail(result.error);
    currentCode = result.room.code;
    currentToken = result.token;
    socket.join(result.room.code);
    socket.emit("room:joined", { code: result.room.code, token: result.token });
    broadcastState(io, result.room);
  });

  socket.on("room:reconnect", ({ code, token }) => {
    const result = rooms.reconnect(code?.toUpperCase(), token, socket.id);
    if (result.error) return fail(result.error);
    currentCode = result.room.code;
    currentToken = token;
    socket.join(result.room.code);
    broadcastState(io, result.room);
  });

  /** Only the host can start, and only once, with 2-5 players present. */
  socket.on("room:start", () => {
    const room = rooms.getRoom(currentCode);
    if (!room) return fail("room-not-found");
    if (!rooms.isHost(room, currentToken)) return fail("not-host");
    if (room.started) return fail("already-started");
    if (room.order.length < MIN_PLAYERS) return fail("need-more-players");

    rooms.fillWithBots(room); // empty seats become bots — game always starts full
    room.engine = new GameEngine();
    room.engine.startGame(room.order); // seat order = join order, tokens double as player ids
    room.started = true;
    broadcastState(io, room);
    runBotLoop(room);
  });

  socket.on("game:playCard", ({ cardId, target }) => {
    withRoom((room) => {
      const result = room.engine.playCard(currentToken, cardId, target ? { target } : {});
      if (!result.ok) return fail(result.reason);
      broadcastState(io, room);
      runBotLoop(room);
    });
  });

  socket.on("game:endTurn", () => {
    withRoom((room) => {
      const result = room.engine.endTurn(currentToken);
      if (!result.ok) return fail(result.reason);
      broadcastState(io, room);
      runBotLoop(room);
    });
  });

  socket.on("game:justSayNo", () => {
    withRoom((room) => {
      const result = room.engine.respondJustSayNo(currentToken);
      if (!result.ok) return fail(result.reason);
      broadcastState(io, room);
      runBotLoop(room);
    });
  });

  socket.on("game:resolvePending", () => {
    withRoom((room) => {
      const result = room.engine.resolvePendingAction();
      if (!result.ok) return fail(result.reason);
      broadcastState(io, room);
      runBotLoop(room);
    });
  });

  socket.on("game:slyDealTargets", (_payload, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    const targets = room.engine.actions
      .getValidSlyDealTargets(currentToken)
      .map((t) => ({ token: t.playerId, cardId: t.card.id, cardName: t.card.name }));
    ack?.(targets);
  });

  socket.on("game:forcedDealTargets", (_payload, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    const targets = room.engine.actions
      .getValidForcedDealTargets(currentToken)
      .map((t) => ({ token: t.playerId, cardId: t.card.id, cardName: t.card.name }));
    ack?.(targets);
  });

  socket.on("game:givableProperties", (_payload, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    const mine = room.engine.actions
      .getGivableProperties(currentToken)
      .map((t) => ({ cardId: t.card.id, cardName: t.card.name }));
    ack?.(mine);
  });

  socket.on("game:dealBreakerTargets", (_payload, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    ack?.(room.engine.actions.getValidDealBreakerTargets(currentToken));
  });

  socket.on("game:rentColors", ({ cardId }, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    const card = room.engine.getHand(currentToken).find((c) => c.id === cardId);
    if (!card) return ack?.([]);
    ack?.(room.engine.actions.getValidRentColors(currentToken, card));
  });

  socket.on("game:houseColors", (_payload, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    ack?.(room.engine.actions.getValidHouseColors(currentToken));
  });

  socket.on("game:hotelColors", (_payload, ack) => {
    const room = rooms.getRoom(currentCode);
    if (!room?.engine) return ack?.([]);
    ack?.(room.engine.actions.getValidHotelColors(currentToken));
  });

  socket.on("room:leave", () => {
    if (!currentCode || !currentToken) return;
    const result = rooms.leaveRoom(currentCode, currentToken);
    if (result.room) {
      broadcastState(io, result.room);
      runBotLoop(result.room);
    }
    socket.leave(currentCode);
    currentCode = null;
    currentToken = null;
  });

  socket.on("disconnect", () => {
    if (!currentCode || !currentToken) return;
    const room = rooms.getRoom(currentCode);
    if (!room) return;
    rooms.markDisconnected(currentCode, currentToken, (r) => {
      broadcastState(io, r);
      runBotLoop(r); // if it becomes the newly-AI seat's turn, keep the game moving
    });
    broadcastState(io, room);
  });

  function withRoom(fn) {
    const room = rooms.getRoom(currentCode);
    if (!room || !room.engine) return fail("no-active-game");
    fn(room);
  }

  /**
   * Steps bots forward one move at a time (via BotAI) so play stays visible
   * and human targets keep their Just Say No window. Also auto-resolves a
   * pending action once every target on it is a bot, so bot-vs-bot rounds
   * don't stall waiting for a response that will never come from a human.
   */
  function runBotLoop(room) {
    if (!room.engine) return;

    const pending = room.engine.actions.pending;
    if (pending) {
      const onlyBotTargets = pending.targets.every((id) => room.players.get(id)?.isBot);
      if (onlyBotTargets) {
        setTimeout(() => {
          if (room.engine?.actions.pending === pending) {
            room.engine.resolvePendingAction();
            broadcastState(io, room);
            runBotLoop(room);
          }
        }, 1000);
      }
      return; // otherwise a human may still respond — wait for them
    }

    const currentId = room.engine.turns.currentPlayer;
    const seat = room.players.get(currentId);
    if (!seat?.isBot) return; // it's a human's turn — nothing to automate

    setTimeout(() => {
      if (room.engine?.turns.currentPlayer !== currentId) return; // state moved on already
      const action = pickBotAction(room.engine, currentId);
      if (!action || action.type === "endTurn") {
        room.engine.endTurn(currentId);
      } else if (action.type === "play") {
        room.engine.playCard(currentId, action.cardId, action.options || {});
      } else if (action.type === "resolve") {
        room.engine.resolvePendingAction();
      }
      broadcastState(io, room);
      runBotLoop(room); // continue this bot's turn, or start the next one
    }, 900);
  }
}
