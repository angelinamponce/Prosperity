// Garden mode's sound effects: short, original tones made with the Web Audio API (no audio files, no
// borrowed music). Silent unless the player turns sound on; the handheld frame sets `enabled` from that
// setting while a Garden-mode screen is open. Nothing plays while the tab is hidden, and it's quiet.

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12); // MIDI note number -> Hz
const C5 = 72;

// Each effect is a list of [midi note, length in seconds, wave]. A null note is a rest.
export const SFX = {
  move: [[C5 + 7, 0.03, "square"]],
  select: [[C5 + 7, 0.04, "square"], [C5 + 12, 0.05, "square"]],
  back: [[C5 + 4, 0.04, "square"], [C5, 0.05, "square"]],
  correct: [[C5, 0.07, "triangle"], [C5 + 4, 0.07, "triangle"], [C5 + 7, 0.12, "triangle"]],
  // A gentle "hmm", never a buzzer: a wrong answer is learning.
  learn: [[C5 + 2, 0.08, "triangle"], [C5 - 1, 0.14, "triangle"]],
  hit: [[C5 - 5, 0.04, "square"], [C5 - 10, 0.06, "square"]],
  levelup: [[C5, 0.07, "square"], [C5 + 4, 0.07, "square"], [C5 + 7, 0.07, "square"], [C5 + 12, 0.18, "square"]],
  badge: [[C5 + 7, 0.08, "triangle"], [C5 + 12, 0.08, "triangle"], [C5 + 16, 0.2, "triangle"]],
  save: [[C5 + 4, 0.06, "triangle"], [C5 + 9, 0.12, "triangle"]],
  rustle: [["noise", 0.18]],
  festival: [
    [C5, 0.1, "square"], [C5 + 4, 0.1, "square"], [C5 + 7, 0.1, "square"], [null, 0.05],
    [C5 + 7, 0.1, "square"], [C5 + 9, 0.1, "square"], [C5 + 12, 0.28, "square"],
  ],
};

let enabled = false;
let ctx = null;

/** Turned on and off by the handheld frame from the player's sound setting. */
export function setSoundEnabled(on) {
  enabled = Boolean(on);
}

function audio() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** Plays a named effect if sound is on. Safe to call anywhere; it's a no-op otherwise. */
export function sfx(name) {
  if (!enabled || !SFX[name] || (typeof document !== "undefined" && document.hidden)) return false;
  const ac = audio();
  if (!ac) return false;
  if (ac.state === "suspended") ac.resume();
  const master = ac.createGain();
  master.gain.value = 0.08;
  master.connect(ac.destination);
  let t = ac.currentTime + 0.01;
  for (const [note, len, wave] of SFX[name]) {
    if (note === "noise") {
      // A soft rustle: a short burst of filtered noise.
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ac.createBufferSource();
      const filter = ac.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2200;
      src.buffer = buf;
      src.connect(filter).connect(master);
      src.start(t);
    } else if (note != null) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = wave;
      osc.frequency.value = NOTE(note);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + len);
      osc.connect(env).connect(master);
      osc.start(t);
      osc.stop(t + len + 0.02);
    }
    t += len;
  }
  return true;
}
