/**
 * i18n.js
 * Central dictionary for UI text that's generated in JavaScript
 * (turn status, hints, prompts) rather than fixed in the HTML —
 * those already use data-en/data-hi attributes on the element itself.
 * Switching language re-renders immediately, no page reload needed.
 */

export const STRINGS = {
  en: {
    yourTurn: "Your turn",
    opponentTurn: "Opponent's turn",
    turnLabel: "Turn",
    selectCardFirst: "Select a card in your hand first.",
    needMorePlayers: "Need at least 2 players to start.",
    readyToStart: "Ready — press Start Game.",
    waitingForHost: "Waiting for the host to start…",
    wonGame: "won the game!",
    you: "You",
    debtCollectorPrompt: "Debt Collector — choose who pays you $5M:",
    slyDealPrompt: "Sly Deal — choose a property to steal:",
    forcedDealPromptTheirs: "Forced Deal — choose their property to take:",
    forcedDealPromptMine: "Forced Deal — choose your property to give up:",
    dealBreakerPrompt: "Deal Breaker — choose a complete set to steal:",
    rentColorPrompt: "Rent — choose which colour to charge:",
    doubleRentPrompt: "Double the rent?",
    noDoubleRent: "No — charge normal rent",
    doubleRentTimes: "Yes, double x",
    houseColorPrompt: "House — choose a complete set:",
    hotelColorPrompt: "Hotel — choose a set with a House:",
    noValidTargets: "No valid targets for that card right now.",
    noGivableProperties: "You have no properties eligible to give up.",
    soundOn: "On",
    soundOff: "Off",
    dark: "Dark",
    light: "Light",
    setsLabel: "Sets",
    gameOver: "Game over",
  },
  hi: {
    yourTurn: "आपकी बारी",
    opponentTurn: "प्रतिद्वंद्वी की बारी",
    turnLabel: "बारी",
    selectCardFirst: "पहले अपने हाथ से एक कार्ड चुनें।",
    needMorePlayers: "शुरू करने के लिए कम से कम 2 खिलाड़ी चाहिए।",
    readyToStart: "तैयार — Start Game दबाएँ।",
    waitingForHost: "होस्ट के शुरू करने का इंतज़ार…",
    wonGame: "ने खेल जीत लिया!",
    you: "आपने",
    debtCollectorPrompt: "डेट कलेक्टर — चुनें कि कौन आपको $5M देगा:",
    slyDealPrompt: "स्लाई डील — चुराने के लिए एक संपत्ति चुनें:",
    forcedDealPromptTheirs: "फ़ोर्स्ड डील — उनकी कौन सी संपत्ति लेनी है चुनें:",
    forcedDealPromptMine: "फ़ोर्स्ड डील — बदले में अपनी कौन सी संपत्ति देंगे चुनें:",
    dealBreakerPrompt: "डील ब्रेकर — चुराने के लिए एक पूरा सेट चुनें:",
    rentColorPrompt: "रेंट — किस रंग का किराया वसूलना है चुनें:",
    doubleRentPrompt: "किराया दोगुना करें?",
    noDoubleRent: "नहीं — सामान्य किराया",
    doubleRentTimes: "हाँ, दोगुना x",
    houseColorPrompt: "हाउस — एक पूरा सेट चुनें:",
    hotelColorPrompt: "होटल — हाउस वाला सेट चुनें:",
    noValidTargets: "अभी इस कार्ड के लिए कोई मान्य लक्ष्य नहीं है।",
    noGivableProperties: "देने लायक कोई संपत्ति नहीं है।",
    soundOn: "चालू",
    soundOff: "बंद",
    dark: "डार्क",
    light: "लाइट",
    setsLabel: "सेट",
    gameOver: "खेल समाप्त",
  },
};

/** Looks up `key` in the currently active language (falls back to English). */
export function t(key) {
  const lang = document.body.getAttribute("data-lang") || "en";
  return STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
}
