/**
 * ActionResolver.js
 * Plays and resolves ACTION cards. Actions that target a player open
 * a "pending action" so any target with a Just Say No card can cancel
 * it before it resolves — including Just Say No cancelling Just Say No.
 *
 * Implemented: Pass Go, It's My Birthday, Debt Collector, Sly Deal,
 * Forced Deal, Deal Breaker, Rent (single/multi-colour/wild) with
 * Double The Rent, House, Hotel, and Just Say No.
 */

import { ACTION_KEYS } from "../models/Card.js";
import { PROPERTY_RENT_TABLE } from "../data/deckData.js";

export class ActionResolver {
  /** @param {import("./GameEngine.js").GameEngine} engine */
  constructor(engine) {
    this.engine = engine;
    this.pending = null; // the one action currently awaiting Just Say No / resolution
    this.log = []; // short human-readable notifications for the UI
  }

  _note(message) {
    this.log.push(message);
    if (this.log.length > 20) this.log.shift();
  }

  /**
   * Entry point called by GameEngine.playCard() for action cards this
   * resolver knows how to run. The card has already been validated as
   * belonging to the acting player's turn; it is NOT yet removed from
   * their hand — that only happens once this returns { ok: true }.
   * @returns {{ok: boolean, reason?: string, pending?: boolean}}
   */
  playActionCard(actorId, card, target = {}) {
    switch (card.actionKey) {
      case ACTION_KEYS.PASS_GO:
        this.engine.drawCards(actorId, 2);
        this.engine.deck.discard(card);
        this._note(`${actorId} played Pass Go and drew 2 cards.`);
        return { ok: true, pending: false };

      case ACTION_KEYS.BIRTHDAY:
        this._openPending(actorId, card, {
          targets: this.engine.players.filter((id) => id !== actorId),
          amountEach: 2,
        });
        return { ok: true, pending: true };

      case ACTION_KEYS.DEBT_COLLECTOR: {
        if (!target.targetPlayerId) return { ok: false, reason: "target-required" };
        this._openPending(actorId, card, { targets: [target.targetPlayerId], amountEach: 5 });
        return { ok: true, pending: true };
      }

      case ACTION_KEYS.SLY_DEAL: {
        if (!target.targetPlayerId || !target.targetCardId) {
          return { ok: false, reason: "target-required" };
        }
        const valid = this.getValidSlyDealTargets(actorId).some(
          (t) => t.playerId === target.targetPlayerId && t.card.id === target.targetCardId
        );
        if (!valid) return { ok: false, reason: "invalid-target" };
        this._openPending(actorId, card, {
          targets: [target.targetPlayerId],
          propertyCardId: target.targetCardId,
        });
        return { ok: true, pending: true };
      }

      case ACTION_KEYS.FORCED_DEAL: {
        if (!target.targetPlayerId || !target.targetCardId || !target.myCardId) {
          return { ok: false, reason: "target-required" };
        }
        const theirsValid = this.getValidForcedDealTargets(actorId).some(
          (t) => t.playerId === target.targetPlayerId && t.card.id === target.targetCardId
        );
        const mineValid = this.getGivableProperties(actorId).some((t) => t.card.id === target.myCardId);
        if (!theirsValid || !mineValid) return { ok: false, reason: "invalid-target" };
        this._openPending(actorId, card, {
          targets: [target.targetPlayerId],
          swapGiveCardId: target.myCardId,
          swapTakeCardId: target.targetCardId,
        });
        return { ok: true, pending: true };
      }

      case ACTION_KEYS.DEAL_BREAKER: {
        if (!target.targetPlayerId || !target.color) return { ok: false, reason: "target-required" };
        if (target.targetPlayerId === actorId) return { ok: false, reason: "invalid-target" };
        if (!this.engine.isSetComplete(target.targetPlayerId, target.color)) {
          return { ok: false, reason: "set-not-complete" };
        }
        this._openPending(actorId, card, { targets: [target.targetPlayerId], stealColor: target.color });
        return { ok: true, pending: true };
      }

      case ACTION_KEYS.RENT: {
        if (!target.color) return { ok: false, reason: "color-required" };
        const validColors = card.color === "any" ? this.engine.getBoard(actorId).getPropertyColors() : card.color;
        if (!validColors.includes(target.color)) return { ok: false, reason: "invalid-color" };

        const board = this.engine.getBoard(actorId);
        const ownedCount = board.getPropertiesByColor(target.color).length;
        if (ownedCount === 0) return { ok: false, reason: "no-properties-of-that-colour" };

        const doubleCount = Math.min(Math.max(target.doubleRentCount || 0, 0), 2);
        const doubleCards = this._takeDoubleRentCards(actorId, doubleCount);
        if (doubleCards.length !== doubleCount) return { ok: false, reason: "not-enough-double-rent-cards" };

        const base = rentAmount(target.color, ownedCount, board.hasHouse(target.color), board.hasHotel(target.color));
        const amountEach = base * 2 ** doubleCount;

        this._openPending(actorId, card, {
          targets: this.engine.players.filter((id) => id !== actorId),
          amountEach,
          rentColor: target.color,
        });
        return { ok: true, pending: true };
      }

      case ACTION_KEYS.DOUBLE_RENT:
        // Only playable alongside a Rent card (see the RENT case above), not on its own.
        return { ok: false, reason: "double-rent-must-accompany-rent" };

      case ACTION_KEYS.HOUSE: {
        if (!target.color) return { ok: false, reason: "color-required" };
        const board = this.engine.getBoard(actorId);
        if (!this.engine.isSetComplete(actorId, target.color)) return { ok: false, reason: "set-not-complete" };
        if (board.hasHouse(target.color)) return { ok: false, reason: "already-has-house" };
        board.addHouse(target.color);
        this.engine.deck.discard(card);
        this._note(`${actorId} added a House to their ${target.color} set.`);
        return { ok: true, pending: false };
      }

      case ACTION_KEYS.HOTEL: {
        if (!target.color) return { ok: false, reason: "color-required" };
        const board = this.engine.getBoard(actorId);
        if (!board.hasHouse(target.color)) return { ok: false, reason: "needs-house-first" };
        if (board.hasHotel(target.color)) return { ok: false, reason: "already-has-hotel" };
        board.addHotel(target.color);
        this.engine.deck.discard(card);
        this._note(`${actorId} added a Hotel to their ${target.color} set.`);
        return { ok: true, pending: false };
      }

      case ACTION_KEYS.JUST_SAY_NO:
        // Only playable as a *response* — see respondJustSayNo(), not this entry point.
        return { ok: false, reason: "just-say-no-must-be-a-response" };

      default:
        return { ok: false, reason: "action-not-implemented-yet" };
    }
  }

  _openPending(actorId, card, details) {
    this.pending = { actorId, card, actionKey: card.actionKey, jsnCount: 0, resolved: false, ...details };
    this._note(`${actorId} played ${card.name} — targets may respond with Just Say No.`);
  }

  /** Removes up to `count` Double The Rent cards from hand and discards them immediately. */
  _takeDoubleRentCards(actorId, count) {
    const hand = this.engine.getHand(actorId);
    const taken = [];
    for (let i = 0; i < count; i++) {
      const idx = hand.findIndex((c) => c.actionKey === ACTION_KEYS.DOUBLE_RENT);
      if (idx === -1) break;
      taken.push(hand.splice(idx, 1)[0]);
    }
    taken.forEach((c) => this.engine.deck.discard(c));
    return taken;
  }

  /** True if `playerId` may currently cancel the pending action with a Just Say No. */
  canRespondJustSayNo(playerId) {
    if (!this.pending || this.pending.resolved) return false;
    if (!this.pending.targets.includes(playerId)) return false;
    return this.engine.getHand(playerId).some((c) => c.actionKey === ACTION_KEYS.JUST_SAY_NO);
  }

  /** `playerId` cancels the pending action using a Just Say No from their hand. */
  respondJustSayNo(playerId) {
    if (!this.canRespondJustSayNo(playerId)) return { ok: false, reason: "cannot-respond" };
    const hand = this.engine.getHand(playerId);
    const index = hand.findIndex((c) => c.actionKey === ACTION_KEYS.JUST_SAY_NO);
    const [jsnCard] = hand.splice(index, 1);
    this.engine.deck.discard(jsnCard);
    this.pending.jsnCount += 1;
    this._note(`${playerId} played Just Say No! (${this.pending.jsnCount} played so far)`);
    return { ok: true };
  }

  /**
   * Closes the response window and applies the effect — unless an odd
   * number of Just Say No cards were played, which cancels it (two
   * Just Say Nos cancel each other out, so the action goes through).
   */
  resolvePending() {
    if (!this.pending || this.pending.resolved) return { ok: false, reason: "nothing-pending" };
    const action = this.pending;
    action.resolved = true;
    this.engine.deck.discard(action.card);

    const cancelled = action.jsnCount % 2 === 1;
    if (cancelled) {
      this._note(`${action.card.name} was cancelled by Just Say No.`);
    } else {
      this._applyEffect(action);
      this._note(`${action.card.name} resolved.`);
    }
    this.pending = null;
    return { ok: true, cancelled };
  }

  _applyEffect(action) {
    const actorBoard = this.engine.getBoard(action.actorId);

    if ([ACTION_KEYS.BIRTHDAY, ACTION_KEYS.DEBT_COLLECTOR, ACTION_KEYS.RENT].includes(action.actionKey)) {
      action.targets.forEach((targetId) => {
        const { cards } = collectPayment(this.engine.getBoard(targetId), action.amountEach);
        cards.forEach((card) => actorBoard.addBankCard(card));
      });
    } else if (action.actionKey === ACTION_KEYS.SLY_DEAL) {
      const targetBoard = this.engine.getBoard(action.targets[0]);
      const stolen = removePropertyById(targetBoard, action.propertyCardId);
      if (stolen) actorBoard.addPropertyCard(stolen.card, stolen.color);
    } else if (action.actionKey === ACTION_KEYS.FORCED_DEAL) {
      const targetBoard = this.engine.getBoard(action.targets[0]);
      const give = removePropertyById(actorBoard, action.swapGiveCardId);
      const take = removePropertyById(targetBoard, action.swapTakeCardId);
      if (take) actorBoard.addPropertyCard(take.card, take.color);
      if (give) targetBoard.addPropertyCard(give.card, give.color);
    } else if (action.actionKey === ACTION_KEYS.DEAL_BREAKER) {
      const targetBoard = this.engine.getBoard(action.targets[0]);
      targetBoard.transferColorGroup(action.stealColor, actorBoard);
    }
  }

  /** One player's own property cards NOT part of a completed set. */
  _nonCompleteProperties(playerId) {
    const board = this.engine.getBoard(playerId);
    const result = [];
    board.getPropertyColors().forEach((color) => {
      if (this.engine.isSetComplete(playerId, color)) return; // protected — needs Deal Breaker
      board.getPropertiesByColor(color).forEach((card) => result.push({ playerId, card }));
    });
    return result;
  }

  /** Opponent property cards NOT part of a completed set (Sly Deal can't touch full sets). */
  getValidSlyDealTargets(actorId) {
    return this.engine.players.filter((id) => id !== actorId).flatMap((id) => this._nonCompleteProperties(id));
  }

  /** Same rule as Sly Deal — Forced Deal also can't take from a completed set. */
  getValidForcedDealTargets(actorId) {
    return this.getValidSlyDealTargets(actorId);
  }

  /** The acting player's own properties they're allowed to give up in a Forced Deal. */
  getGivableProperties(actorId) {
    return this._nonCompleteProperties(actorId);
  }

  /** Opponent colour groups that are complete sets — the only valid Deal Breaker targets. */
  getValidDealBreakerTargets(actorId) {
    const targets = [];
    this.engine.players
      .filter((id) => id !== actorId)
      .forEach((playerId) => {
        this.engine
          .getBoard(playerId)
          .getPropertyColors()
          .filter((color) => this.engine.isSetComplete(playerId, color))
          .forEach((color) => targets.push({ playerId, color }));
      });
    return targets;
  }

  /** Colours a Rent card can legally be played for (must own at least one). */
  getValidRentColors(actorId, card) {
    const board = this.engine.getBoard(actorId);
    const candidateColors = card.color === "any" ? board.getPropertyColors() : card.color;
    return candidateColors.filter((color) => board.getPropertiesByColor(color).length > 0);
  }

  /** Complete sets the player owns that don't have a House yet. */
  getValidHouseColors(actorId) {
    const board = this.engine.getBoard(actorId);
    return board.getPropertyColors().filter(
      (color) => this.engine.isSetComplete(actorId, color) && !board.hasHouse(color)
    );
  }

  /** Sets that already have a House but no Hotel yet. */
  getValidHotelColors(actorId) {
    const board = this.engine.getBoard(actorId);
    return board.getPropertyColors().filter((color) => board.hasHouse(color) && !board.hasHotel(color));
  }
}

/** Rent for owning `count` properties of `color`, plus House/Hotel bonuses. */
function rentAmount(color, count, hasHouse, hasHotel) {
  const table = PROPERTY_RENT_TABLE[color] || [1, 2, 3, 4, 5];
  const base = table[Math.min(count, table.length) - 1] ?? table[table.length - 1];
  return base + (hasHouse ? 3 : 0) + (hasHotel ? 4 : 0);
}

/** Takes cards from `board`'s bank (largest first) until `amountOwed` is covered. */
function collectPayment(board, amountOwed) {
  const sorted = [...board.bank].sort((a, b) => b.moneyValue - a.moneyValue);
  const cards = [];
  let total = 0;
  for (const card of sorted) {
    if (total >= amountOwed) break;
    cards.push(card);
    total += card.moneyValue;
  }
  cards.forEach((card) => {
    const idx = board.bank.indexOf(card);
    if (idx !== -1) board.bank.splice(idx, 1);
  });
  return { cards, totalPaid: total, shortfall: Math.max(0, amountOwed - total) };
}

/** Removes and returns a specific property card from a board, by id, along with the colour it was filed under. */
function removePropertyById(board, cardId) {
  for (const color of board.getPropertyColors()) {
    const group = board.getPropertiesByColor(color);
    const idx = group.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const [card] = group.splice(idx, 1);
      if (group.length === 0) board.properties.delete(color);
      return { card, color };
    }
  }
  return null;
}
