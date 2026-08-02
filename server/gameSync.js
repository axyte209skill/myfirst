/**
 * gameSync.js
 * Turns a server-side GameEngine into the JSON each socket is allowed
 * to see. This is the privacy boundary: only the viewing player's own
 * hand is ever included in full — every other hand is a count only.
 */

import { SETS_TO_WIN } from "../js/engine/GameEngine.js";

/** Converts a PlayerBoard (Map-based) into plain, JSON-safe data. */
function serializeBoard(board) {
  return {
    properties: Object.fromEntries(
      board.getPropertyColors().map((color) => [color, board.getPropertiesByColor(color)])
    ),
    bank: board.bank,
    bankValue: board.bankValue,
    houses: [...board.houses],
    hotels: [...board.hotels],
  };
}

/** Builds the exact state payload one specific player (`viewerToken`) may see. */
export function buildStateForPlayer(room, viewerToken) {
  const engine = room.engine;
  const roster = room.order.map((token) => room.players.get(token));

  const opponents = roster
    .filter((p) => p.token !== viewerToken)
    .map((p) => ({
      token: p.token,
      name: p.name,
      isBot: p.isBot,
      connected: p.connected,
      handCount: engine.getHand(p.token).length,
      board: serializeBoard(engine.getBoard(p.token)),
      completeSets: engine.countCompleteSets(p.token),
    }));

  const pending = engine.actions.pending
    ? {
        actorId: engine.actions.pending.actorId,
        cardName: engine.actions.pending.card.name,
        jsnCount: engine.actions.pending.jsnCount,
        canRespond: engine.actions.canRespondJustSayNo(viewerToken),
      }
    : null;

  return {
    myToken: viewerToken,
    myHand: engine.getHand(viewerToken),
    myBoard: serializeBoard(engine.getBoard(viewerToken)),
    myCompleteSets: engine.countCompleteSets(viewerToken),
    setsToWin: SETS_TO_WIN,
    opponents,
    deckCount: engine.deck.remainingCount,
    discardCount: engine.deck.discardCount,
    turn: {
      currentPlayer: engine.turns.currentPlayer,
      turnNumber: engine.turns.turnNumber,
      cardsRemaining: engine.turns.cardsRemaining(),
    },
    pending,
    winner: engine.getWinner(),
    notifications: engine.actions.log.slice(-6),
  };
}

function summaryOf(room) {
  return {
    code: room.code,
    started: room.started,
    players: room.order.map((token) => {
      const p = room.players.get(token);
      return { token: p.token, name: p.name, isHost: p.isHost, connected: p.connected, isBot: p.isBot };
    }),
  };
}

/** Sends every connected human player their own view of the same room/game. */
export function broadcastState(io, room) {
  room.order.forEach((token) => {
    const player = room.players.get(token);
    if (!player.connected || player.isBot) return;
    const game = room.engine ? buildStateForPlayer(room, token) : null;
    io.to(player.socketId).emit("room:update", { room: summaryOf(room), game });
  });
}
