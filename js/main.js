/* =============================================================
   MONOPOLY DEAL — NETWORKED CLIENT (rooms + live sync via Socket.io)
   render.js is untouched — a small RemoteBoardView adapter lets its
   board-rendering functions work with the server's JSON. The client
   NEVER decides outcomes: Play Card / End Turn / Just Say No are just
   requests sent to the server; what happens is decided by the
   server's GameEngine and echoed back via "room:update".
   This pass adds: bots-fill-empty-seats (server side), a Settings
   menu (Theme/Language/Sound/Leave Room), synthesized sound effects,
   a small i18n module for dynamic text, a win celebration, and
   removes the temporary on-screen debug panel (kept as console logs).
   ============================================================= */

import { ACTION_KEYS } from "./models/Card.js";
import { PROPERTY_SET_SIZES } from "./data/deckData.js";
import { t } from "./data/i18n.js";
import { sounds, isSoundEnabled, setSoundEnabled } from "./audio/sounds.js";
import {
  renderMyHand,
  renderOpponentHand,
  renderPropertyArea,
  renderBank,
  renderNotifications,
  renderTargetPicker,
  renderPendingAction,
} from "./ui/render.js";

const body = document.body;

/* ---------- Theme (unchanged logic, now also mirrored in Settings) ---------- */
const themeToggle = document.getElementById("themeToggle");
const settingsThemeBtn = document.getElementById("settingsThemeBtn");
const settingsThemeValue = document.getElementById("settingsThemeValue");

function applyTheme(theme) {
  body.setAttribute("data-theme", theme);
  localStorage.setItem("md-theme", theme);
  settingsThemeValue.textContent = theme === "dark" ? t("dark") : t("light");
}

function toggleTheme() {
  sounds.click();
  applyTheme(body.getAttribute("data-theme") === "dark" ? "light" : "dark");
}

themeToggle.addEventListener("click", toggleTheme);
settingsThemeBtn.addEventListener("click", toggleTheme);
applyTheme(localStorage.getItem("md-theme") || "dark");

/* ---------- Language (unchanged logic, now also mirrored in Settings) ---------- */
const langSelect = document.getElementById("langSelect");
const settingsLangSelect = document.getElementById("settingsLangSelect");

function applyLanguage(lang) {
  body.setAttribute("data-lang", lang);
  document.querySelectorAll("[data-en]").forEach((el) => {
    const text = lang === "hi" ? el.dataset.hi : el.dataset.en;
    if (text) el.textContent = text;
  });
  langSelect.value = lang;
  settingsLangSelect.value = lang;
  localStorage.setItem("md-lang", lang);
  applyTheme(body.getAttribute("data-theme")); // refresh the theme label's translation too
  if (latestGame) renderGame(); // re-render dynamic (non data-en/hi) strings immediately
}

langSelect.addEventListener("change", (e) => applyLanguage(e.target.value));
settingsLangSelect.addEventListener("change", (e) => applyLanguage(e.target.value));
applyLanguage(localStorage.getItem("md-lang") || "en");

/* ---------- Settings menu ---------- */
const settingsOverlay = document.getElementById("settingsOverlay");
const soundToggleBtn = document.getElementById("soundToggleBtn");
const soundToggleValue = document.getElementById("soundToggleValue");

function refreshSoundLabel() {
  soundToggleValue.textContent = isSoundEnabled() ? t("soundOn") : t("soundOff");
}
refreshSoundLabel();

document.getElementById("menuBtn").addEventListener("click", () => {
  sounds.click();
  settingsOverlay.hidden = false;
});
document.getElementById("closeSettingsBtn").addEventListener("click", () => {
  sounds.click();
  settingsOverlay.hidden = true;
});
soundToggleBtn.addEventListener("click", () => {
  setSoundEnabled(!isSoundEnabled());
  refreshSoundLabel();
  sounds.click();
});
document.getElementById("leaveRoomBtn").addEventListener("click", () => {
  socket.emit("room:leave");
  localStorage.removeItem("md-token");
  localStorage.removeItem("md-code");
  location.reload();
});

/* ---------- DOM references ---------- */
const lobbyScreen = document.getElementById("lobbyScreen");
const lobbyForms = document.getElementById("lobbyForms");
const lobbyErrorEl = document.getElementById("lobbyError");
const waitingRoomEl = document.getElementById("waitingRoom");
const waitingRoomCodeEl = document.getElementById("waitingRoomCode");
const playerListEl = document.getElementById("playerList");
const startGameBtn = document.getElementById("startGameBtn");
const waitingHintEl = document.getElementById("waitingHint");
const gameScreenEl = document.getElementById("gameScreen");

const roomCodeTopnavEl = document.getElementById("roomCode");
const opponentsEl = document.getElementById("opponents");
const myHandEl = document.getElementById("myHand");
const gameStatusEl = document.getElementById("gameStatus");
const myPropertiesEl = document.querySelector("#myProperties .board__slots");
const myBankEl = document.querySelector("#myBank .board__slots");
const setsProgressEl = document.getElementById("setsProgress");
const playCardBtn = document.getElementById("playCardBtn");
const endTurnBtn = document.getElementById("endTurnBtn");
const notificationsEl = document.getElementById("notifications");
const targetPickerEl = document.getElementById("targetPicker");
const pendingActionEl = document.getElementById("pendingAction");
const winOverlayEl = document.getElementById("winOverlay");
const winTitleEl = document.getElementById("winTitle");

/* ---------- Identity + reconnect ---------- */
let myToken = localStorage.getItem("md-token") || null;
let myCode = localStorage.getItem("md-code") || null;
let selectedCardId = null;
let latestRoom = null;
let latestGame = null;
let lastHandCount = null; // used only to trigger a "draw" sound on hand growth
let winnerAnnounced = false;

const socket = io();

function persistIdentity(code, token) {
  myCode = code;
  myToken = token;
  localStorage.setItem("md-code", code);
  localStorage.setItem("md-token", token);
}

socket.on("connect", () => {
  if (myCode && myToken) socket.emit("room:reconnect", { code: myCode, token: myToken });
});

socket.on("room:joined", ({ code, token }) => {
  persistIdentity(code, token);
  lobbyErrorEl.textContent = "";
});

socket.on("room:error", ({ reason }) => {
  console.warn("[Monopoly Deal] server rejected an action:", reason);
  if (latestRoom?.started) gameStatusEl.textContent = `Error: ${reason}`;
  else lobbyErrorEl.textContent = `Error: ${reason}`;
});

socket.on("room:update", ({ room, game }) => {
  console.debug("[Monopoly Deal] state sync", { room, game });
  latestRoom = room;
  latestGame = game;
  render();
});

/* ---------- Lobby actions ---------- */
document.getElementById("createRoomBtn").addEventListener("click", () => {
  sounds.click();
  const name = document.getElementById("createNameInput").value.trim() || "Host";
  socket.emit("room:create", { name });
});

document.getElementById("joinRoomBtn").addEventListener("click", () => {
  sounds.click();
  const name = document.getElementById("joinNameInput").value.trim() || "Player";
  const code = document.getElementById("joinCodeInput").value.trim().toUpperCase();
  if (!code) {
    lobbyErrorEl.textContent = "Enter a room code.";
    return;
  }
  socket.emit("room:join", { code, name });
});

startGameBtn.addEventListener("click", () => {
  sounds.click();
  socket.emit("room:start");
});

/* ---------- Board adapter: lets render.js's board functions run unchanged ---------- */
class RemoteBoardView {
  constructor(data) {
    this._properties = (data && data.properties) || {};
    this.bank = (data && data.bank) || [];
    this.bankValue = (data && data.bankValue) || 0;
    this._houses = new Set((data && data.houses) || []);
    this._hotels = new Set((data && data.hotels) || []);
  }
  getPropertyColors() {
    return Object.keys(this._properties);
  }
  getPropertiesByColor(color) {
    return this._properties[color] || [];
  }
  hasHouse(color) {
    return this._houses.has(color);
  }
  hasHotel(color) {
    return this._hotels.has(color);
  }
}

function isColorComplete(board, color) {
  const required = PROPERTY_SET_SIZES[color];
  return !!required && board.getPropertiesByColor(color).length >= required;
}

function pulseBoard(el) {
  el.classList.remove("board--pulse");
  void el.offsetWidth;
  el.classList.add("board--pulse");
}

/** A few short-lived confetti pieces for the win celebration — lightweight, self-removing. */
function launchConfetti() {
  const colors = ["#e0a458", "#2f9e64", "#d14848", "#7ec8e3", "#e6c229"];
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

function handleCardClick(card) {
  sounds.click();
  selectedCardId = selectedCardId === card.id ? null : card.id;
  targetPickerEl.hidden = true;
  render();
}

function commitPlayCard(cardId, target) {
  sounds.play();
  socket.emit("game:playCard", { cardId, target });
  selectedCardId = null;
  targetPickerEl.hidden = true;
}

/* ---------- Rendering (reads latestRoom/latestGame only — never decides anything) ---------- */
function render() {
  if (!latestRoom) return;
  const inGame = latestRoom.started && latestGame;
  lobbyScreen.hidden = !!inGame;
  gameScreenEl.hidden = !inGame;
  inGame ? renderGame() : renderWaitingRoom();
}

function renderWaitingRoom() {
  lobbyForms.hidden = true;
  waitingRoomEl.hidden = false;
  waitingRoomCodeEl.textContent = latestRoom.code;
  roomCodeTopnavEl.textContent = latestRoom.code;

  playerListEl.innerHTML = "";
  latestRoom.players.forEach((p) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><span class="conn-dot ${p.connected ? "" : "conn-dot--offline"}"></span>${p.name}${
      p.isHost ? '<span class="host-badge">HOST</span>' : ""
    }</span>
      <span>${p.isBot ? "AI" : p.connected ? "Ready" : "Offline"}</span>
    `;
    playerListEl.appendChild(li);
  });

  const iAmHost = !!latestRoom.players.find((p) => p.token === myToken)?.isHost;
  startGameBtn.hidden = !iAmHost;
  startGameBtn.disabled = latestRoom.players.length < 2;
  waitingHintEl.textContent = iAmHost
    ? latestRoom.players.length < 2
      ? t("needMorePlayers")
      : t("readyToStart")
    : t("waitingForHost");
}

function renderGame() {
  roomCodeTopnavEl.textContent = latestRoom.code;

  if (lastHandCount !== null && latestGame.myHand.length > lastHandCount) sounds.draw();
  lastHandCount = latestGame.myHand.length;

  renderMyHand(myHandEl, latestGame.myHand, { selectedCardId, onCardClick: handleCardClick });

  opponentsEl.innerHTML = "";
  latestGame.opponents.forEach((opp) => {
    const el = document.createElement("article");
    el.className =
      "opponent" +
      (latestGame.turn.currentPlayer === opp.token ? " is-turn" : "") +
      (!opp.connected && !opp.isBot ? " opponent--offline" : "");

    const nameRow = document.createElement("div");
    nameRow.className = "opponent__name";
    const status = opp.isBot ? " (AI)" : !opp.connected ? " (offline)" : "";
    nameRow.innerHTML = `<span class="turn-dot"></span> ${opp.name}${status}`;

    const handEl = document.createElement("div");
    handEl.className = "opponent__hand";
    renderOpponentHand(handEl, opp.handCount);

    const row = document.createElement("div");
    row.className = "opponent__row";
    row.innerHTML = `<span data-en="Properties" data-hi="संपत्ति">Properties</span><span data-en="Bank" data-hi="बैंक">Bank</span>`;

    const strip = document.createElement("div");
    strip.className = "opponent__strip";
    strip.textContent = `$${opp.board.bankValue}M · ${opp.completeSets}/${latestGame.setsToWin} ${t("setsLabel")}`;

    el.append(nameRow, handEl, row, strip);
    opponentsEl.appendChild(el);
  });
  applyLanguage(body.getAttribute("data-lang"));

  const myBoard = new RemoteBoardView(latestGame.myBoard);
  renderPropertyArea(myPropertiesEl, myBoard, (color) => isColorComplete(myBoard, color));
  renderBank(myBankEl, myBoard);
  renderNotifications(notificationsEl, latestGame.notifications);

  setsProgressEl.textContent = `${latestGame.myCompleteSets}/${latestGame.setsToWin} ${t("setsLabel")}`;
  setsProgressEl.classList.toggle("sets-progress--won", latestGame.myCompleteSets >= latestGame.setsToWin);

  playCardBtn.disabled = !!latestGame.winner;
  endTurnBtn.disabled = !!latestGame.winner;

  renderPendingAction(
    pendingActionEl,
    latestGame.pending && {
      actorId: latestGame.pending.actorId,
      card: { name: latestGame.pending.cardName },
      jsnCount: latestGame.pending.jsnCount,
    },
    {
      canRespond: !!latestGame.pending?.canRespond,
      onJustSayNo: () => {
        sounds.click();
        socket.emit("game:justSayNo");
      },
      onResolve: () => {
        sounds.rent();
        socket.emit("game:resolvePending");
        pulseBoard(myPropertiesEl);
        pulseBoard(myBankEl);
      },
    }
  );

  const isMyTurn = latestGame.turn.currentPlayer === myToken;
  gameStatusEl.textContent = latestGame.winner
    ? `${latestGame.winner === myToken ? t("you") : "Bot/Player " + latestGame.winner.slice(0, 4)} ${t("wonGame")}`
    : `${isMyTurn ? t("yourTurn") : t("opponentTurn")} — ${t("turnLabel")} ${latestGame.turn.turnNumber}`;

  console.debug("[Monopoly Deal] turn", latestGame.turn, "deck:", latestGame.deckCount, "discard:", latestGame.discardCount);

  if (latestGame.winner && !winnerAnnounced) {
    winnerAnnounced = true;
    winTitleEl.textContent = `🎉 ${latestGame.winner === myToken ? t("you") : "They"} ${t("wonGame")}`;
    winOverlayEl.hidden = false;
    launchConfetti();
    sounds.win();
  }
}

document.getElementById("winCloseBtn").addEventListener("click", () => {
  sounds.click();
  winOverlayEl.hidden = true;
});

/* ---------- Play Card / End Turn ---------- */
playCardBtn.addEventListener("click", () => {
  if (!latestGame) return;
  if (latestGame.winner) return;
  if (!selectedCardId) {
    gameStatusEl.textContent = t("selectCardFirst");
    return;
  }
  const card = latestGame.myHand.find((c) => c.id === selectedCardId);
  if (!card) return;

  if (card.actionKey === ACTION_KEYS.DEBT_COLLECTOR) {
    renderTargetPicker(
      targetPickerEl,
      t("debtCollectorPrompt"),
      latestGame.opponents.map((o) => ({
        label: o.name,
        onPick: () => commitPlayCard(card.id, { targetPlayerId: o.token }),
      }))
    );
    return;
  }

  if (card.actionKey === ACTION_KEYS.SLY_DEAL) {
    socket.emit("game:slyDealTargets", {}, (targets) => {
      renderTargetPicker(
        targetPickerEl,
        t("slyDealPrompt"),
        targets.map((tgt) => ({
          label: `${tgt.cardName} (from ${tgt.token})`,
          onPick: () => commitPlayCard(card.id, { targetPlayerId: tgt.token, targetCardId: tgt.cardId }),
        }))
      );
    });
    return;
  }

  if (card.actionKey === ACTION_KEYS.FORCED_DEAL) {
    socket.emit("game:forcedDealTargets", {}, (theirs) => {
      if (!theirs.length) {
        gameStatusEl.textContent = t("noValidTargets");
        return;
      }
      renderTargetPicker(
        targetPickerEl,
        t("forcedDealPromptTheirs"),
        theirs.map((tgt) => ({
          label: `${tgt.cardName} (from ${tgt.token})`,
          onPick: () => {
            socket.emit("game:givableProperties", {}, (mine) => {
              if (!mine.length) {
                gameStatusEl.textContent = t("noGivableProperties");
                return;
              }
              renderTargetPicker(
                targetPickerEl,
                t("forcedDealPromptMine"),
                mine.map((m) => ({
                  label: m.cardName,
                  onPick: () =>
                    commitPlayCard(card.id, { targetPlayerId: tgt.token, targetCardId: tgt.cardId, myCardId: m.cardId }),
                }))
              );
            });
          },
        }))
      );
    });
    return;
  }

  if (card.actionKey === ACTION_KEYS.DEAL_BREAKER) {
    socket.emit("game:dealBreakerTargets", {}, (targets) => {
      if (!targets.length) {
        gameStatusEl.textContent = t("noValidTargets");
        return;
      }
      renderTargetPicker(
        targetPickerEl,
        t("dealBreakerPrompt"),
        targets.map((tgt) => ({
          label: `${tgt.color} (from ${tgt.token})`,
          onPick: () => commitPlayCard(card.id, { targetPlayerId: tgt.token, color: tgt.color }),
        }))
      );
    });
    return;
  }

  if (card.actionKey === ACTION_KEYS.RENT) {
    socket.emit("game:rentColors", { cardId: card.id }, (colors) => {
      if (!colors.length) {
        gameStatusEl.textContent = t("noValidTargets");
        return;
      }
      renderTargetPicker(
        targetPickerEl,
        t("rentColorPrompt"),
        colors.map((color) => ({ label: color, onPick: () => promptDoubleRent(card, color) }))
      );
    });
    return;
  }

  if (card.actionKey === ACTION_KEYS.HOUSE) {
    socket.emit("game:houseColors", {}, (colors) => {
      if (!colors.length) {
        gameStatusEl.textContent = t("noValidTargets");
        return;
      }
      renderTargetPicker(
        targetPickerEl,
        t("houseColorPrompt"),
        colors.map((color) => ({ label: color, onPick: () => commitPlayCard(card.id, { color }) }))
      );
    });
    return;
  }

  if (card.actionKey === ACTION_KEYS.HOTEL) {
    socket.emit("game:hotelColors", {}, (colors) => {
      if (!colors.length) {
        gameStatusEl.textContent = t("noValidTargets");
        return;
      }
      renderTargetPicker(
        targetPickerEl,
        t("hotelColorPrompt"),
        colors.map((color) => ({ label: color, onPick: () => commitPlayCard(card.id, { color }) }))
      );
    });
    return;
  }

  commitPlayCard(card.id, undefined);
});

/** Second step for Rent: offer to stack Double The Rent cards the player actually holds (max 2). */
function promptDoubleRent(card, color) {
  const heldDoubleRent = latestGame.myHand.filter((c) => c.actionKey === ACTION_KEYS.DOUBLE_RENT).length;
  if (heldDoubleRent === 0) {
    commitPlayCard(card.id, { color, doubleRentCount: 0 });
    return;
  }
  const options = [{ label: t("noDoubleRent"), onPick: () => commitPlayCard(card.id, { color, doubleRentCount: 0 }) }];
  for (let n = 1; n <= Math.min(heldDoubleRent, 2); n++) {
    options.push({
      label: `${t("doubleRentTimes")}${n}`,
      onPick: () => commitPlayCard(card.id, { color, doubleRentCount: n }),
    });
  }
  renderTargetPicker(targetPickerEl, t("doubleRentPrompt"), options);
}

endTurnBtn.addEventListener("click", () => {
  if (!latestGame || latestGame.winner) return;
  sounds.click();
  socket.emit("game:endTurn");
  selectedCardId = null;
  targetPickerEl.hidden = true;
});
