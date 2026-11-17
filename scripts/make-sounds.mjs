// Generates assets/sounds/rest-over.wav: three short rising beeps (16-bit mono PCM, 22.05 kHz).
// Made from scratch here, so there's no licence to track. Run with `pnpm sounds`; commit the output.
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;
const BEEPS = [
  { hz: 880, ms: 140 },
  { hz: 880, ms: 140 },
  { hz: 1320, ms: 260 },
];
const GAP_MS = 90;
const VOLUME = 0.8;

const samples = [];
for (const [i, { hz, ms }] of BEEPS.entries()) {
  const n = Math.round((RATE * ms) / 1000);
  for (let s = 0; s < n; s++) {
    // 8 ms fade in/out so the beeps don't click.
    const fade = Math.min(1, s / (RATE * 0.008), (n - s) / (RATE * 0.008));
    samples.push(Math.sin((2 * Math.PI * hz * s) / RATE) * VOLUME * fade);
  }
  if (i < BEEPS.length - 1) {
    for (let s = 0; s < Math.round((RATE * GAP_MS) / 1000); s++) samples.push(0);
  }
}

const data = Buffer.alloc(samples.length * 2);
samples.forEach((v, i) => data.writeInt16LE(Math.round(v * 32767), i * 2));
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

mkdirSync("assets/sounds", { recursive: true });
writeFileSync("assets/sounds/rest-over.wav", Buffer.concat([header, data]));
console.log(`assets/sounds/rest-over.wav  ${samples.length} samples`);
