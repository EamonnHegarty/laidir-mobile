// Generates the app icon, Android adaptive icon layers, splash image and notification icon from one
// vector "L" (no fonts, so the output is the same on every machine). Run: pnpm icons
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const images = join(root, "assets/images");

// Keep in sync with Brand in src/constants/theme.ts.
const GREEN = "#3DDC84";
const ICON_BG = "#0E1A14";

// Slab-serif L in a 100×100 box, centred on (50, 50).
const L_PATH = "M22 18 H56 V25 H48 V71 H69 V62 H78 V82 H22 V75 H30 V25 H22 Z";

/** The L at `scale` of the canvas (1 = fills the 100-unit box), centred. */
function letter(color, scale) {
  const offset = 50 - 50 * scale;
  return `<path d="${L_PATH}" fill="${color}" transform="translate(${offset} ${offset}) scale(${scale})"/>`;
}

function svg({ background, color, scale }) {
  const bg = background ? `<rect width="100" height="100" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${bg}${letter(color, scale)}</svg>`;
}

async function render(name, size, spec) {
  const png = new Resvg(svg(spec), { fitTo: { mode: "width", value: size } }).render().asPng();
  const out = join(images, name);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, png);
  console.log(`assets/images/${name} (${size}px)`);
}

// Legacy/full icon: square with the brand background (launchers apply their own mask).
await render("icon.png", 1024, { background: ICON_BG, color: GREEN, scale: 0.78 });
// Adaptive icon: only the centre ~66% is guaranteed visible, so the L sits well inside it.
await render("android-icon-foreground.png", 1024, { color: GREEN, scale: 0.56 });
await render("android-icon-background.png", 1024, {
  background: ICON_BG,
  color: ICON_BG,
  scale: 0,
});
// Themed icons (Android 13+): single-colour silhouette, tinted by the system.
await render("android-icon-monochrome.png", 1024, { color: "#FFFFFF", scale: 0.56 });
// Splash: green L on the dark splash background (set in app.config.ts).
await render("splash-icon.png", 512, { color: GREEN, scale: 0.9 });
// Notification small icon: Android uses only the alpha channel, so white on transparent.
await render("notification-icon.png", 96, { color: "#FFFFFF", scale: 0.9 });
