/**
 * GameEngine.js
 * Coordinates players, hands, and the deck. This is the only place
 * that mutates game state — UI code should call these methods
 * rather than touching the deck or hands directly.
 */

import { Deck } from "./Deck.js";
import { TurnManager } from "./TurnManager.js";
import { ActionResolver } from "./ActionResolver.js";
import { PlayerBoard } from "../models/PlayerBoard.js";
import { CARD_TYPES, ACTION_KEYS } from "../models/Card.js";
import { PROPERTY_SET_SIZES } from "../data/deckData.js";

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const INITIAL_HAND_SIZE = 5;
export const SETS_TO_WIN = 3;
const IMPLEMENTED_ACTIONS = [
  ACTION_KEYS.PASS_GO,
  ACTION_KEYS.BIRTHDAY,
  ACTION_KEYS.DEBT_COLLECTOR,
  ACTION_KEYS.SLY_DEAL,
  ACTION_KEYS.FORCED_DEAL,
  ACTION_KEYS.DEAL_BREAKER,
  ACTION_KEYS.RENT,
  ACTION_KEYS.DOUBLE_RENT,
  ACTION_KEYS.HOUSE,
  ACTION_KEYS.HOTEL,
];

export class GameEngine {
  constructor() {
    this.deck = new Deck();
    this.players = []; // array of player ids, in turn order
    this.hands = new Map(); // playerId -> Card[]
    this.boards = new Map(); // playerId -> PlayerBoard (properties + bank)
    this.turns = new TurnManager(this);
    this.actions = new ActionResolver(this);
  }

  /**
   * Starts a new game: validates player count, builds + shuffles a
   * fresh deck, clears old hands, and deals the opening hand to each player.
   * @param {string[]} playerIds
   */
  startGame(playerIds) {
    if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
      throw new Error(
        `Monopoly Deal supports ${MIN_PLAYERS}-${MAX_PLAYERS} players, got ${playerIds.length}.`
      );
    }

    this.players = [...playerIds];
    this.hands = new Map(this.players.map((id) => [id, []]));
    this.boards = new Map(this.players.map((id) => [id, new PlayerBoard()]));

    this.deck.build();
    this.deck.shuffle();

    this.players.forEach((playerId) => this.drawCards(playerId, INITIAL_HAND_SIZE));

    this.turns.startMatch(this.players); // sets turn 1 and draws the +2 turn-start cards
  }

  /**
   * Plays a card out of a player's hand, routing it to the right place:
   * Property/Wild Property -> that player's property board,
   * Money -> that player's bank,
   * Action -> discard pile, unless `asMoney` is set, then it's banked instead.
   * @param {string} playerId
   * @param {string} cardId
   * @param {{colorChoice?: string, asMoney?: boolean}} [options]
   * @returns {{ok: boolean, reason?: string, destination?: string}}
   */
  playCard(playerId, cardId, options = {}) {
    if (this.getWinner()) {
      return { ok: false, reason: "game-over" };
    }
    if (!this.turns.isCurrentPlayer(playerId)) {
      return { ok: false, reason: "not-your-turn" };
    }
    if (this.turns.cardsRemaining() <= 0) {
      return { ok: false, reason: "max-cards-reached" };
    }

    const hand = this._requireHand(playerId);
    const index = hand.findIndex((card) => card.id === cardId);
    if (index === -1) {
      return { ok: false, reason: "card-not-in-hand" };
    }

    const card = hand[index];
    const board = this.boards.get(playerId);
    let destination;

    if (card.type === CARD_TYPES.PROPERTY || card.type === CARD_TYPES.WILD_PROPERTY) {
      board.addPropertyCard(card, options.colorChoice ?? null);
      destination = "property";
    } else if (card.type === CARD_TYPES.MONEY) {
      board.addBankCard(card);
      destination = "bank";
    } else if (card.type === CARD_TYPES.ACTION) {
      if (IMPLEMENTED_ACTIONS.includes(card.actionKey)) {
        const result = this.actions.playActionCard(playerId, card, options.target || {});
        if (!result.ok) return { ok: false, reason: result.reason };
        destination = result.pending ? "pending-action" : "resolved";
      } else if (options.asMoney) {
        board.addBankCard(card);
        destination = "bank";
      } else {
        this.deck.discard(card); // action effects for this card come in a later module
        destination = "discard";
      }
    } else {
      return { ok: false, reason: "invalid-card-type" };
    }

    hand.splice(index, 1); // remove from hand only after a valid destination was found
    this.turns.recordCardPlayed();
    return { ok: true, destination };
  }

  /** `playerId` cancels the currently pending action with a Just Say No from their hand. */
  respondJustSayNo(playerId) {
    if (this.getWinner()) return { ok: false, reason: "game-over" };
    return this.actions.respondJustSayNo(playerId);
  }

  /** Closes the Just Say No window and applies (or cancels) the pending action. */
  resolvePendingAction() {
    if (this.getWinner()) return { ok: false, reason: "game-over" };
    return this.actions.resolvePending();
  }

  /** Ends `playerId`'s turn immediately and starts the next player's turn. */
  endTurn(playerId) {
    if (this.getWinner()) {
      return { ok: false, reason: "game-over" };
    }
    if (!this.turns.isCurrentPlayer(playerId)) {
      return { ok: false, reason: "not-your-turn" };
    }
    this.turns.endTurn();
    return { ok: true };
  }

  /** True once a colour has enough property cards on `playerId`'s board to be a full set. */
  isSetComplete(playerId, color) {
    const board = this.boards.get(playerId);
    const requiredSize = PROPERTY_SET_SIZES[color];
    return !!board && !!requiredSize && board.isColorComplete(color, requiredSize);
  }

  getBoard(playerId) {
    return this.boards.get(playerId) || new PlayerBoard();
  }

  /** How many complete property sets `playerId` currently has on their board. */
  countCompleteSets(playerId) {
    const board = this.boards.get(playerId);
    if (!board) return 0;
    return board.getPropertyColors().filter((color) => this.isSetComplete(playerId, color)).length;
  }

  /** Returns the winning player's id (SETS_TO_WIN+ complete sets), or null if no one has won yet. */
  getWinner() {
    for (const playerId of this.players) {
      if (this.countCompleteSets(playerId) >= SETS_TO_WIN) return playerId;
    }
    return null;
  }

  /** Re-shuffles the current draw pile without resetting hands. */
  shuffleDeck() {
    this.deck.shuffle();
  }

  /**
   * Draws `count` cards from the deck into a player's hand.
   * @param {string} playerId
   * @param {number} count
   * @returns {Card[]} the cards that were drawn
   */
  drawCards(playerId, count) {
    const hand = this._requireHand(playerId);
    const drawn = this.deck.draw(count);
    hand.push(...drawn);
    return drawn;
  }

  /**
   * Removes a specific card from a player's hand and moves it to discard.
   * @param {string} playerId
   * @param {string} cardId
   * @returns {boolean} true if a card was found and discarded
   */
  discardCard(playerId, cardId) {
    const hand = this._requireHand(playerId);
    const index = hand.findIndex((card) => card.id === cardId);
    if (index === -1) return false;

    const [card] = hand.splice(index, 1);
    this.deck.discard(card);
    return true;
  }

  /** Discards a random card from a player's hand — used by the test panel. */
  discardRandomCard(playerId) {
    const hand = this._requireHand(playerId);
    if (hand.length === 0) return false;
    const randomCard = hand[Math.floor(Math.random() * hand.length)];
    return this.discardCard(playerId, randomCard.id);
  }

  getHand(playerId) {
    return this.hands.get(playerId) || [];
  }

  _requireHand(playerId) {
    if (!this.hands.has(playerId)) {
      throw new Error(`Unknown player id: ${playerId}`);
    }
    return this.hands.get(playerId);
  }
}
