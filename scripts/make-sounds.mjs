// Generates the rest-over sounds in assets/sounds/ (16-bit mono PCM WAV, 22.05 kHz). They're
// synthesised here from sine waves, so there's no licence to track. Run with `pnpm sounds` and
// commit the output.
//
//   rest_over.wav  Beeps: three short rising beeps
//   bell.wav       Boxing bell: four quick strikes of a bright metal bell, ringing out
//   chime.wav      Chime: two soft descending tones
//   buzzer.wav     Buzzer: a gym-clock buzz
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;

/** Seconds → sample count. */
const n = (seconds) => Math.round(RATE * seconds);

/** A tone with a short fade in and out so it doesn't click. */
function tone(hz, seconds, volume = 0.8) {
  const len = n(seconds);
  const out = new Float32Array(len);
  const fade = RATE * 0.008;
  for (let s = 0; s < len; s++) {
    out[s] =
      Math.sin((2 * Math.PI * hz * s) / RATE) * volume * Math.min(1, s / fade, (len - s) / fade);
  }
  return out;
}

/**
 * A struck bell: inharmonic partials (ratios of a real bell's modes), each decaying at its own
 * rate, plus a short noisy "clang" at the strike.
 */
function strike(hz, seconds, volume = 0.7) {
  const partials = [
    { ratio: 1, amp: 1, decay: 1.6 },
    { ratio: 2.76, amp: 0.6, decay: 2.6 },
    { ratio: 5.4, amp: 0.4, decay: 4 },
    { ratio: 8.93, amp: 0.25, decay: 6 },
    { ratio: 13.34, amp: 0.15, decay: 9 },
  ];
  const len = n(seconds);
  const out = new Float32Array(len);
  let seed = 7;
  const noise = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };
  for (let s = 0; s < len; s++) {
    const t = s / RATE;
    let v = 0;
    for (const p of partials)
      v += p.amp * Math.exp(-p.decay * t) * Math.sin(2 * Math.PI * hz * p.ratio * t);
    v += noise() * 0.5 * Math.exp(-60 * t);
    // 2 ms attack, then the natural decay; a short release at the end.
    const env = Math.min(1, t / 0.002, (len - s) / (RATE * 0.05));
    out[s] = (v / 2.4) * volume * env;
  }
  return out;
}

/** A buzzer: a square-ish wave (odd harmonics) with a little vibrato. */
function buzz(hz, seconds, volume = 0.5) {
  const len = n(seconds);
  const out = new Float32Array(len);
  const fade = RATE * 0.01;
  for (let s = 0; s < len; s++) {
    const t = s / RATE;
    const f = hz * (1 + 0.01 * Math.sin(2 * Math.PI * 6 * t));
    let v = 0;
    for (let k = 1; k <= 9; k += 2) v += Math.sin(2 * Math.PI * f * k * t) / k;
    out[s] = v * volume * 0.8 * Math.min(1, s / fade, (len - s) / fade);
  }
  return out;
}

const silence = (seconds) => new Float32Array(n(seconds));

/** Overlays parts at start times (seconds) into one buffer. */
function mix(parts) {
  const len = Math.max(...parts.map(({ at, data }) => n(at) + data.length));
  const out = new Float32Array(len);
  for (const { at, data } of parts) {
    const offset = n(at);
    for (let s = 0; s < data.length; s++) out[offset + s] += data[s];
  }
  // Overlapping strikes add up: scale down if the peak would clip.
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (peak > 0.95) for (let s = 0; s < len; s++) out[s] *= 0.95 / peak;
  return out;
}

const concat = (...chunks) => {
  const out = new Float32Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
};

const SOUNDS = {
  rest_over: concat(
    tone(880, 0.14),
    silence(0.09),
    tone(880, 0.14),
    silence(0.09),
    tone(1320, 0.26),
  ),
  // Fast "ding-ding-ding-ding" like the end-of-round bell: quick strikes, the last one rings out.
  bell: mix([
    { at: 0, data: strike(660, 1.2) },
    { at: 0.15, data: strike(660, 1.2) },
    { at: 0.3, data: strike(660, 1.2) },
    { at: 0.45, data: strike(660, 1.9) },
  ]),
  chime: mix([
    { at: 0, data: strike(1046.5, 1.2, 0.45) },
    { at: 0.35, data: strike(784, 1.6, 0.45) },
  ]),
  buzzer: concat(buzz(220, 0.45), silence(0.12), buzz(220, 0.7)),
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) =>
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2),
  );
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

mkdirSync("assets/sounds", { recursive: true });
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = `assets/sounds/${name}.wav`;
  writeFileSync(file, wav(samples));
  console.log(`${file}  ${(samples.length / RATE).toFixed(2)} s`);
}
