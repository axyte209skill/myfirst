/**
 * deckData.js
 * Source-of-truth data for the full Monopoly Deal deck.
 * Cards are generated from small config tables instead of being
 * written out one-by-one, so counts/rents stay easy to tweak.
 */

import { CARD_TYPES, ACTION_KEYS } from "../models/Card.js";

let idCounter = 0;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/* ---------- Property colour sets ---------- */
/* count = how many single-colour property cards exist for that set */
const PROPERTY_SETS = [
  { color: "brown", count: 2, rentValues: [1, 2], moneyValue: 1 },
  { color: "lightblue", count: 3, rentValues: [1, 2, 3], moneyValue: 1 },
  { color: "pink", count: 3, rentValues: [1, 2, 4], moneyValue: 2 },
  { color: "orange", count: 3, rentValues: [1, 3, 5], moneyValue: 2 },
  { color: "red", count: 3, rentValues: [2, 3, 6], moneyValue: 3 },
  { color: "yellow", count: 3, rentValues: [2, 4, 6], moneyValue: 3 },
  { color: "green", count: 3, rentValues: [2, 4, 7], moneyValue: 4 },
  { color: "darkblue", count: 2, rentValues: [3, 8], moneyValue: 4 },
  { color: "railroad", count: 4, rentValues: [1, 2, 3, 4], moneyValue: 2 },
  { color: "utility", count: 2, rentValues: [1, 2], moneyValue: 2 },
];

/* ---------- Wild (dual-colour) property pairs ---------- */
const WILD_PAIRS = [
  { colors: ["brown", "lightblue"], count: 1 },
  { colors: ["pink", "orange"], count: 2 },
  { colors: ["red", "yellow"], count: 2 },
  { colors: ["green", "darkblue"], count: 1 },
  { colors: ["railroad", "utility"], count: 1 },
  { colors: ["railroad", "green"], count: 1 },
];

/* ---------- Money card denominations ---------- */
const MONEY_CARDS = [
  { value: 1, count: 6 },
  { value: 2, count: 5 },
  { value: 3, count: 3 },
  { value: 4, count: 3 },
  { value: 5, count: 2 },
  { value: 10, count: 1 },
];

/* ---------- Action cards ---------- */
const ACTION_CARDS = [
  { name: "Deal Breaker", count: 2, moneyValue: 5, description: "Steal a complete property set.", actionKey: ACTION_KEYS.DEAL_BREAKER },
  { name: "Just Say No", count: 3, moneyValue: 4, description: "Cancel an action card played against you.", actionKey: ACTION_KEYS.JUST_SAY_NO },
  { name: "Sly Deal", count: 3, moneyValue: 3, description: "Steal one property from an opponent.", actionKey: ACTION_KEYS.SLY_DEAL },
  { name: "Force Deal", count: 4, moneyValue: 3, description: "Swap one property with an opponent.", actionKey: ACTION_KEYS.FORCED_DEAL },
  { name: "Debt Collector", count: 3, moneyValue: 3, description: "Force an opponent to pay you $5M.", actionKey: ACTION_KEYS.DEBT_COLLECTOR },
  { name: "It's My Birthday", count: 3, moneyValue: 2, description: "Every opponent pays you $2M.", actionKey: ACTION_KEYS.BIRTHDAY },
  { name: "Double The Rent", count: 2, moneyValue: 1, description: "Double the rent of your next rent card.", actionKey: ACTION_KEYS.DOUBLE_RENT },
  { name: "House", count: 3, moneyValue: 3, description: "Add $3M rent to a complete set.", actionKey: ACTION_KEYS.HOUSE },
  { name: "Hotel", count: 2, moneyValue: 4, description: "Add $4M rent to a set that has a House.", actionKey: ACTION_KEYS.HOTEL },
  { name: "Pass Go", count: 10, moneyValue: 1, description: "Draw 2 extra cards.", actionKey: ACTION_KEYS.PASS_GO },
];

/* ---------- Rent cards (charge rent for matching-colour sets) ---------- */
const RENT_CARDS = [
  { colors: ["brown", "lightblue"], count: 2, actionKey: ACTION_KEYS.RENT },
  { colors: ["pink", "orange"], count: 2, actionKey: ACTION_KEYS.RENT },
  { colors: ["red", "yellow"], count: 2, actionKey: ACTION_KEYS.RENT },
  { colors: ["green", "darkblue"], count: 2, actionKey: ACTION_KEYS.RENT },
  { colors: ["railroad", "utility"], count: 2, actionKey: ACTION_KEYS.RENT },
];
const WILD_RENT_COUNT = 3; // rent card usable on any colour

/**
 * Map of colour -> number of single-colour property cards needed to
 * complete that set (used by PlayerBoard to detect completed sets).
 */
export const PROPERTY_SET_SIZES = Object.fromEntries(
  PROPERTY_SETS.map((set) => [set.color, set.count])
);

/**
 * Map of colour -> rent amount indexed by (owned count - 1), e.g.
 * PROPERTY_RENT_TABLE.brown[0] is rent for owning 1 brown, [1] for 2.
 * Used by the Rent action card to compute what opponents owe.
 */
export const PROPERTY_RENT_TABLE = Object.fromEntries(
  PROPERTY_SETS.map((set) => [set.color, set.rentValues])
);

/**
 * Builds and returns the full deck as plain config objects
 * (ready to be passed into `new Card(config)`).
 */
export function buildFullDeckData() {
  const data = [];

  // Property cards (single colour)
  PROPERTY_SETS.forEach((set) => {
    for (let i = 0; i < set.count; i++) {
      data.push({
        id: nextId(`prop-${set.color}`),
        name: `${capitalize(set.color)} Property`,
        type: CARD_TYPES.PROPERTY,
        color: set.color,
        rentValues: set.rentValues,
        moneyValue: set.moneyValue,
        description: `Part of the ${capitalize(set.color)} property set.`,
      });
    }
  });

  // Wild property cards (dual colour)
  WILD_PAIRS.forEach((pair) => {
    for (let i = 0; i < pair.count; i++) {
      data.push({
        id: nextId("wild"),
        name: `${pair.colors.map(capitalize).join(" / ")} Wild`,
        type: CARD_TYPES.WILD_PROPERTY,
        color: pair.colors,
        rentValues: null,
        moneyValue: 4,
        description: "Can be played as either colour shown.",
      });
    }
  });

  // Money cards
  MONEY_CARDS.forEach((money) => {
    for (let i = 0; i < money.count; i++) {
      data.push({
        id: nextId(`money-${money.value}`),
        name: `$${money.value}M`,
        type: CARD_TYPES.MONEY,
        color: null,
        rentValues: null,
        moneyValue: money.value,
        description: "Money card — used to pay rent and fees.",
      });
    }
  });

  // Action cards
  ACTION_CARDS.forEach((action) => {
    for (let i = 0; i < action.count; i++) {
      data.push({
        id: nextId(`action-${slug(action.name)}`),
        name: action.name,
        type: CARD_TYPES.ACTION,
        color: null,
        rentValues: null,
        moneyValue: action.moneyValue,
        description: action.description,
        actionKey: action.actionKey,
      });
    }
  });

  // Rent cards (modelled as action cards tied to specific colours)
  RENT_CARDS.forEach((rent) => {
    for (let i = 0; i < rent.count; i++) {
      data.push({
        id: nextId("rent"),
        name: `Rent (${rent.colors.map(capitalize).join("/")})`,
        type: CARD_TYPES.ACTION,
        color: rent.colors,
        rentValues: null,
        moneyValue: 1,
        description: "Charge rent for a matching-colour property set.",
        actionKey: rent.actionKey,
      });
    }
  });
  for (let i = 0; i < WILD_RENT_COUNT; i++) {
    data.push({
      id: nextId("rent-wild"),
      name: "Rent (Any Colour)",
      type: CARD_TYPES.ACTION,
      color: "any",
      rentValues: null,
      moneyValue: 3,
      description: "Charge rent for any one colour set you own.",
      actionKey: ACTION_KEYS.RENT,
    });
  }

  return data;
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
