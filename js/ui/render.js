/**
 * render.js
 * Pure rendering helpers. These read game-engine data and produce
 * DOM nodes — they never mutate hands, the deck, or game rules.
 */

/**
 * Renders the local player's real hand (face-up, playable cards).
 * @param {HTMLElement} containerEl
 * @param {Card[]} hand
 * @param {{selectedCardId?: string|null, onCardClick?: (card: Card) => void}} [options]
 */
export function renderMyHand(containerEl, hand, options = {}) {
  containerEl.innerHTML = "";
  hand.forEach((card) => {
    const el = buildCardElement(card);
    if (card.id === options.selectedCardId) el.classList.add("card--selected");
    if (options.onCardClick) el.addEventListener("click", () => options.onCardClick(card));
    containerEl.appendChild(el);
  });
}

/** Builds one face-up card element from a Card instance. */
function buildCardElement(card) {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.cardId = card.id;
  if (card.color) {
    const strip = Array.isArray(card.color) ? card.color[0] : card.color;
    el.style.setProperty("--strip-color", colorToCss(strip));
  }
  el.textContent = card.name;
  return el;
}

/** Renders an opponent's hand as hidden card backs only — never the real cards. */
export function renderOpponentHand(containerEl, cardCount) {
  containerEl.innerHTML = "";
  for (let i = 0; i < cardCount; i++) {
    const back = document.createElement("div");
    back.className = "card card--back";
    containerEl.appendChild(back);
  }
}

/** Updates the temporary debug panel with current counts + turn state. */
export function renderDebugPanel(panelEl, stats) {
  panelEl.innerHTML = `
    <div>Deck: <strong>${stats.deckCount}</strong></div>
    <div>Discard: <strong>${stats.discardCount}</strong></div>
    <div>My Hand: <strong>${stats.myHandCount}</strong></div>
    ${stats.opponentCounts
      .map((count, i) => `<div>P${i + 2} Hand: <strong>${count}</strong></div>`)
      .join("")}
    <div>Turn #: <strong>${stats.turnNumber}</strong></div>
    <div>Current Player: <strong>${stats.currentPlayer}</strong></div>
    <div>Cards Played: <strong>${stats.cardsPlayed}/${stats.maxCards}</strong></div>
  `;
}

/**
 * Renders one player's property board, grouped by colour. Completed
 * sets get a "complete" highlight class.
 * @param {HTMLElement} containerEl
 * @param {import("../models/PlayerBoard.js").PlayerBoard} board
 * @param {(color: string) => boolean} isColorComplete
 */
export function renderPropertyArea(containerEl, board, isColorComplete) {
  containerEl.innerHTML = "";
  const colors = board.getPropertyColors();

  if (colors.length === 0) {
    containerEl.innerHTML = `<div class="property-empty">No properties yet</div>`;
    return;
  }

  colors.forEach((color) => {
    const group = document.createElement("div");
    group.className = "property-group" + (isColorComplete(color) ? " property-group--complete" : "");
    group.style.setProperty("--strip-color", colorToCss(color));

    const label = document.createElement("div");
    label.className = "property-group__label";
    label.textContent = `${color} (${board.getPropertiesByColor(color).length})`;
    group.appendChild(label);

    if (board.hasHouse?.(color)) {
      const houseBadge = document.createElement("span");
      houseBadge.className = "building-badge";
      houseBadge.textContent = "House";
      group.appendChild(houseBadge);
    }
    if (board.hasHotel?.(color)) {
      const hotelBadge = document.createElement("span");
      hotelBadge.className = "building-badge building-badge--hotel";
      hotelBadge.textContent = "Hotel";
      group.appendChild(hotelBadge);
    }

    containerEl.appendChild(group);
  });
}

/** Renders a player's bank as small chips plus a running total. */
export function renderBank(containerEl, board) {
  containerEl.innerHTML = "";
  const total = document.createElement("div");
  total.className = "bank-total";
  total.textContent = `$${board.bankValue}M`;
  containerEl.appendChild(total);

  board.bank.forEach((card) => {
    const chip = document.createElement("div");
    chip.className = "bank-chip";
    chip.textContent = `$${card.moneyValue}M`;
    containerEl.appendChild(chip);
  });
}

/** Maps a card colour key to a real CSS colour for the top strip. */
function colorToCss(color) {
  const map = {
    brown: "#8b5a2b",
    lightblue: "#7ec8e3",
    pink: "#e91e8c",
    orange: "#f28c28",
    red: "#d14848",
    yellow: "#e6c229",
    green: "#2f9e64",
    darkblue: "#1c4e9e",
    railroad: "#333333",
    utility: "#8a8a8a",
  };
  return map[color] || "var(--accent)";
}

/** Renders the last few action-card notifications as small toast lines. */
export function renderNotifications(containerEl, messages) {
  containerEl.innerHTML = "";
  messages.slice(-4).forEach((message) => {
    const el = document.createElement("div");
    el.className = "notification";
    el.textContent = message;
    containerEl.appendChild(el);
  });
}

/**
 * Renders a list of valid targets as clickable buttons — e.g. opponents
 * for Debt Collector, or single opponent properties for Sly Deal.
 * @param {HTMLElement} containerEl
 * @param {string} title
 * @param {{label: string, onPick: () => void}[]} options
 */
export function renderTargetPicker(containerEl, title, options) {
  if (!options || options.length === 0) {
    containerEl.hidden = true;
    containerEl.innerHTML = "";
    return;
  }
  containerEl.hidden = false;
  containerEl.innerHTML = `<div class="target-picker__title">${title}</div>`;
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "target-option";
    btn.textContent = opt.label;
    btn.addEventListener("click", opt.onPick);
    containerEl.appendChild(btn);
  });
}

/**
 * Renders the currently pending action (if any) with a Just Say No
 * button (only enabled for players who can actually respond) and a
 * Resolve button to close the response window.
 */
export function renderPendingAction(containerEl, pending, options) {
  if (!pending) {
    containerEl.hidden = true;
    containerEl.innerHTML = "";
    return;
  }
  containerEl.hidden = false;
  containerEl.innerHTML = `
    <div class="pending-action__title">
      ${pending.actorId} played ${pending.card.name} — awaiting response
      (Just Say No played so far: ${pending.jsnCount})
    </div>
  `;

  const row = document.createElement("div");
  row.className = "pending-action__row";

  const jsnBtn = document.createElement("button");
  jsnBtn.className = "mini-btn";
  jsnBtn.textContent = "Just Say No (as me)";
  jsnBtn.disabled = !options.canRespond;
  jsnBtn.addEventListener("click", options.onJustSayNo);

  const resolveBtn = document.createElement("button");
  resolveBtn.className = "mini-btn";
  resolveBtn.textContent = "Resolve Now";
  resolveBtn.addEventListener("click", options.onResolve);

  row.append(jsnBtn, resolveBtn);
  containerEl.appendChild(row);
}
