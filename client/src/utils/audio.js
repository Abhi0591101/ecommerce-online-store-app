/**
 * Shared Web Audio helper — unlocks on first user gesture so browsers
 * don't block order/delivery alert chimes.
 */

let sharedCtx = null;
let unlocked = false;

export function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) sharedCtx = new AC();
  return sharedCtx;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  // Silent blip primes the context on some mobile browsers
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.00001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {
    /* ignore */
  }
  unlocked = true;
}

export function ensureAudioUnlockedOnGesture() {
  if (typeof window === 'undefined' || unlocked) return () => {};
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  return () => {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
}

function tone(freq, duration = 0.35, type = 'sine', gainValue = 0.09, when = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime + when;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Double-beep for new merchant / radar orders */
export function playDoubleBeep() {
  unlockAudio();
  tone(880, 0.18, 'sine', 0.1, 0);
  tone(1175, 0.22, 'sine', 0.09, 0.16);
}

/** Cash-register ascending ding for OTP delivery complete */
export function playCashRegister() {
  unlockAudio();
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => tone(freq, 0.16, 'square', 0.08, i * 0.08));
}

export function playSuccess() {
  unlockAudio();
  tone(880, 0.3, 'sine', 0.08);
}

export function playError() {
  unlockAudio();
  tone(220, 0.35, 'sawtooth', 0.08);
}

export function playAlert(freq = 720) {
  unlockAudio();
  tone(freq, 0.35, 'sine', 0.09);
}

export default {
  unlockAudio,
  ensureAudioUnlockedOnGesture,
  playDoubleBeep,
  playCashRegister,
  playSuccess,
  playError,
  playAlert
};
