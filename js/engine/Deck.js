/**
 * Deck.js
 * Owns the draw pile and discard pile. No UI code here —
 * pure game-state logic that render.js reads from.
 */

import { Card } from "../models/Card.js";
import { buildFullDeckData } from "../data/deckData.js";

export class Deck {
  constructor() {
    this.drawPile = [];
    this.discardPile = [];
  }

  /** (Re)builds a fresh, full deck of Card instances. */
  build() {
    this.drawPile = buildFullDeckData().map((config) => new Card(config));
    this.discardPile = [];
  }

  /** Fisher-Yates shuffle — unbiased, in-place shuffle of the draw pile. */
  shuffle() {
    const pile = this.drawPile;
    for (let i = pile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pile[i], pile[j]] = [pile[j], pile[i]];
    }
  }

  /**
   * Removes up to `count` cards from the top of the draw pile.
   * If the draw pile runs out, the discard pile is reshuffled back in
   * (standard Monopoly Deal behaviour) so the game never stalls.
   * @returns {Card[]} the drawn cards
   */
  draw(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      if (this.drawPile.length === 0) {
        this._recycleDiscardIntoDraw();
        if (this.drawPile.length === 0) break; // truly nothing left
      }
      drawn.push(this.drawPile.pop());
    }
    return drawn;
  }

  /** Moves a single card into the discard pile. */
  discard(card) {
    if (card) this.discardPile.push(card);
  }

  get remainingCount() {
    return this.drawPile.length;
  }

  get discardCount() {
    return this.discardPile.length;
  }

  _recycleDiscardIntoDraw() {
    this.drawPile = this.discardPile;
    this.discardPile = [];
    this.shuffle();
  }
}
