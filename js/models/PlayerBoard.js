/**
 * PlayerBoard.js
 * One player's table area: properties grouped by colour, and their bank.
 * Plain state + helpers only — no DOM, no turn rules.
 */

export class PlayerBoard {
  constructor() {
    this.properties = new Map(); // colour -> Card[]
    this.bank = []; // Card[] (money cards, or action cards banked as money)
    this.houses = new Set(); // colours with a House played on their complete set
    this.hotels = new Set(); // colours with a Hotel played (requires a House first)
  }

  /**
   * Adds a property (or wild property) card to a colour group.
   * @param {Card} card
   * @param {string|null} colorChoice - required for wild cards with 2+
   *   possible colours; ignored for single-colour property cards.
   * @returns {string} the colour the card was actually filed under
   */
  addPropertyCard(card, colorChoice = null) {
    const color = Array.isArray(card.color)
      ? colorChoice || card.color[0] // default to first listed colour
      : card.color;

    if (!this.properties.has(color)) this.properties.set(color, []);
    this.properties.get(color).push(card);
    return color;
  }

  /** Adds a money card, or an action card played as money, to the bank. */
  addBankCard(card) {
    this.bank.push(card);
  }

  /** Total $M currently sitting in the bank. */
  get bankValue() {
    return this.bank.reduce((sum, card) => sum + (card.moneyValue || 0), 0);
  }

  /** True once a colour has at least `requiredSize` property cards. */
  isColorComplete(color, requiredSize) {
    const group = this.properties.get(color);
    return !!group && group.length >= requiredSize;
  }

  getPropertyColors() {
    return [...this.properties.keys()];
  }

  getPropertiesByColor(color) {
    return this.properties.get(color) || [];
  }

  addHouse(color) {
    this.houses.add(color);
  }

  addHotel(color) {
    this.hotels.add(color);
  }

  hasHouse(color) {
    return this.houses.has(color);
  }

  hasHotel(color) {
    return this.hotels.has(color);
  }

  /** Moves an entire colour group (and any House/Hotel on it) to another board — used by Deal Breaker. */
  transferColorGroup(color, targetBoard) {
    const cards = this.properties.get(color) || [];
    cards.forEach((card) => targetBoard.addPropertyCard(card, color));
    this.properties.delete(color);
    if (this.hasHouse(color)) {
      targetBoard.addHouse(color);
      this.houses.delete(color);
    }
    if (this.hasHotel(color)) {
      targetBoard.addHotel(color);
      this.hotels.delete(color);
    }
  }
}
