/**
 * Card.js
 * Plain data model for a single Monopoly Deal card.
 * No rendering logic lives here — this is engine/data only.
 */

export const CARD_TYPES = Object.freeze({
  PROPERTY: "PROPERTY",
  MONEY: "MONEY",
  ACTION: "ACTION",
  WILD_PROPERTY: "WILD_PROPERTY",
});

/** Identifies which specific action a Card of type ACTION performs. */
export const ACTION_KEYS = Object.freeze({
  PASS_GO: "PASS_GO",
  BIRTHDAY: "BIRTHDAY",
  DEBT_COLLECTOR: "DEBT_COLLECTOR",
  SLY_DEAL: "SLY_DEAL",
  FORCED_DEAL: "FORCED_DEAL",
  DEAL_BREAKER: "DEAL_BREAKER",
  DOUBLE_RENT: "DOUBLE_RENT",
  HOUSE: "HOUSE",
  HOTEL: "HOTEL",
  RENT: "RENT",
  JUST_SAY_NO: "JUST_SAY_NO",
});

export class Card {
  /**
   * @param {Object} config
   * @param {string} config.id - unique card id
   * @param {string} config.name - display name
   * @param {string} config.type - one of CARD_TYPES
   * @param {string|string[]|null} config.color - property colour(s), if applicable
   * @param {number[]|null} config.rentValues - rent per set-size, if a property
   * @param {number} config.moneyValue - value in $M when used as money/payment
   * @param {string} config.description - short rules text
   * @param {string|null} config.image - reserved for future art (CSS cards for now)
   */
  constructor({
    id,
    name,
    type,
    color = null,
    rentValues = null,
    moneyValue = 0,
    description = "",
    image = null,
    actionKey = null,
  }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.color = color;
    this.rentValues = rentValues;
    this.moneyValue = moneyValue;
    this.description = description;
    this.image = image; // always null — cards are rendered with CSS, not images
    this.actionKey = actionKey; // one of ACTION_KEYS, only set for type ACTION
  }
}
