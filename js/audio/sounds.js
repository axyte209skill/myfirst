/**
 * sounds.js
 * Tiny sound effects synthesized with the Web Audio API — no audio
 * files, no external libraries. Each call is a short beep; if audio
 * is unavailable (or turned off) it fails silently.
 */

let ctx = null;
let enabled = JSON.parse(localStorage.getItem("md-sound") ?? "true");

function getContext() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function beep({ freq = 440, duration = 0.12, type = "sine", volume = 0.15, delay = 0 } = {}) {
  if (!enabled) return;
  try {
    const audioCtx = getContext();
    const startAt = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    osc.stop(startAt + duration);
  } catch {
    // Audio isn't available in this browser/context — just skip the sound.
  }
}

export const sounds = {
  click: () => beep({ freq: 520, duration: 0.05 }),
  draw: () => beep({ freq: 320, duration: 0.08, type: "triangle" }),
  play: () => beep({ freq: 660, duration: 0.09, type: "square" }),
  rent: () => beep({ freq: 200, duration: 0.18, type: "sawtooth" }),
  win: () => [523, 659, 784, 1047].forEach((freq, i) => beep({ freq, duration: 0.25, type: "triangle", delay: i * 0.14 })),
};

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(value) {
  enabled = value;
  localStorage.setItem("md-sound", JSON.stringify(value));
}
