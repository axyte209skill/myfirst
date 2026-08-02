/**
 * TurnManager.js
 * Owns whose turn it is, the turn number, and how many cards the
 * current player has played this turn. Draws from the deck at the
 * start of every turn via the GameEngine it's attached to.
 */

export const MAX_CARDS_PER_TURN = 3;
export const CARDS_DRAWN_PER_TURN = 2;

export class TurnManager {
  /** @param {import("./GameEngine.js").GameEngine} engine */
  constructor(engine) {
    this.engine = engine;
    this.turnOrder = [];
    this.currentIndex = 0;
    this.turnNumber = 0;
    this.cardsPlayedThisTurn = 0;
  }

  /** Begins a match: sets turn order, resets counters, draws for player 1. */
  startMatch(turnOrder) {
    this.turnOrder = [...turnOrder];
    this.currentIndex = 0;
    this.turnNumber = 1;
    this.cardsPlayedThisTurn = 0;
    this._drawForCurrentPlayer();
  }

  get currentPlayer() {
    return this.turnOrder[this.currentIndex] ?? null;
  }

  isCurrentPlayer(playerId) {
    return this.turnOrder.length > 0 && this.currentPlayer === playerId;
  }

  /** Cards left this turn (0 once the 3-card limit is hit). */
  cardsRemaining() {
    return Math.max(0, MAX_CARDS_PER_TURN - this.cardsPlayedThisTurn);
  }

  /** Whether `playerId` is allowed to play a card right now. */
  canPlayCard(playerId) {
    return this.isCurrentPlayer(playerId) && this.cardsPlayedThisTurn < MAX_CARDS_PER_TURN;
  }

  /** Called by GameEngine.playCard() after a card is successfully played. */
  recordCardPlayed() {
    this.cardsPlayedThisTurn += 1;
  }

  /** Ends the current player's turn immediately and starts the next one. */
  endTurn() {
    if (this.turnOrder.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.turnOrder.length;
    this.turnNumber += 1;
    this.cardsPlayedThisTurn = 0;
    this._drawForCurrentPlayer();
  }

  _drawForCurrentPlayer() {
    if (this.currentPlayer) {
      this.engine.drawCards(this.currentPlayer, CARDS_DRAWN_PER_TURN);
    }
  }
}
