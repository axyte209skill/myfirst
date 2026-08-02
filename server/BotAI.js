/**
 * BotAI.js
 * Deliberately simple — bots do NOT need advanced strategy. Each call
 * to pickBotAction() returns the next single thing a bot should do;
 * the caller (socketHandlers.js) applies it through GameEngine and
 * calls again until the bot's turn is over. This keeps every bot move
 * going through the exact same validated engine calls a human's would.
 */

import { CARD_TYPES, ACTION_KEYS } from "../js/models/Card.js";

// Actions a bot is willing to actively play (rather than just bank as money).
const BOT_PLAYABLE_ACTIONS = [
  ACTION_KEYS.PASS_GO,
  ACTION_KEYS.BIRTHDAY,
  ACTION_KEYS.DEBT_COLLECTOR,
  ACTION_KEYS.HOUSE,
  ACTION_KEYS.HOTEL,
  ACTION_KEYS.RENT,
];

/**
 * Decides the bot's next move.
 * @returns {{type: "play", cardId: string, options?: object} | {type: "resolve"} | {type: "endTurn"} | null}
 *   null means "wait" — e.g. a pending action is out of the bot's hands right now.
 */
export function pickBotAction(engine, botId) {
  const pending = engine.actions.pending;
  if (pending) {
    // Only the bot that opened the pending action auto-resolves it (and only
    // once it's actually safe to — the caller decides that; see runBotLoop).
    return pending.actorId === botId ? { type: "resolve" } : null;
  }

  if (!engine.turns.isCurrentPlayer(botId) || engine.turns.cardsRemaining() <= 0) {
    return { type: "endTurn" };
  }

  const card = chooseCardToPlay(engine, botId);
  if (!card) return { type: "endTurn" };

  if (card.type === CARD_TYPES.ACTION && !BOT_PLAYABLE_ACTIONS.includes(card.actionKey)) {
    // Rent/Deal-Breaker/etc. aren't wired up as effects yet — bank them as money instead.
    return { type: "play", cardId: card.id, options: { asMoney: true } };
  }

  if (card.actionKey === ACTION_KEYS.DEBT_COLLECTOR) {
    const targetId = richestOpponent(engine, botId);
    if (!targetId) return { type: "play", cardId: card.id, options: { asMoney: true } };
    return { type: "play", cardId: card.id, options: { target: { targetPlayerId: targetId } } };
  }

  if (card.actionKey === ACTION_KEYS.HOUSE) {
    const [color] = engine.actions.getValidHouseColors(botId);
    if (!color) return { type: "play", cardId: card.id, options: { asMoney: true } };
    return { type: "play", cardId: card.id, options: { target: { color } } };
  }

  if (card.actionKey === ACTION_KEYS.HOTEL) {
    const [color] = engine.actions.getValidHotelColors(botId);
    if (!color) return { type: "play", cardId: card.id, options: { asMoney: true } };
    return { type: "play", cardId: card.id, options: { target: { color } } };
  }

  if (card.actionKey === ACTION_KEYS.RENT) {
    const [color] = engine.actions.getValidRentColors(botId, card);
    if (!color) return { type: "play", cardId: card.id, options: { asMoney: true } };
    return { type: "play", cardId: card.id, options: { target: { color } } };
  }

  return { type: "play", cardId: card.id };
}

/** Obvious-card priority: properties first, then easy no/self-target actions, then money. */
function chooseCardToPlay(engine, botId) {
  const hand = engine.getHand(botId);
  const property = hand.find((c) => c.type === CARD_TYPES.PROPERTY || c.type === CARD_TYPES.WILD_PROPERTY);
  if (property) return property;

  const passGo = hand.find((c) => c.actionKey === ACTION_KEYS.PASS_GO);
  if (passGo) return passGo;

  const house = hand.find((c) => c.actionKey === ACTION_KEYS.HOUSE && engine.actions.getValidHouseColors(botId).length);
  if (house) return house;

  const hotel = hand.find((c) => c.actionKey === ACTION_KEYS.HOTEL && engine.actions.getValidHotelColors(botId).length);
  if (hotel) return hotel;

  const birthday = hand.find((c) => c.actionKey === ACTION_KEYS.BIRTHDAY);
  if (birthday) return birthday;

  const debtCollector = hand.find((c) => c.actionKey === ACTION_KEYS.DEBT_COLLECTOR);
  if (debtCollector) return debtCollector;

  const rent = hand.find((c) => c.actionKey === ACTION_KEYS.RENT && engine.actions.getValidRentColors(botId, c).length);
  if (rent) return rent;

  return hand.find((c) => c.type === CARD_TYPES.MONEY) || null;
}

function richestOpponent(engine, botId) {
  const others = engine.players.filter((id) => id !== botId);
  if (others.length === 0) return null;
  return [...others].sort((a, b) => engine.getBoard(b).bankValue - engine.getBoard(a).bankValue)[0];
}
