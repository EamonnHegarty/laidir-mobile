# laidir-mobile

The **Láidir** app: a local-first gym tracker. Expo / React Native (TypeScript), Android first, sideloaded APK.

It works fully offline from SQLite on the phone. Sync with the API arrives in phase 3; Claude integration (optional)
in phase 4. Related repos: [laidir-api](https://github.com/EamonnHegarty/laidir-api) (owns the data contract) and
[laidir-infra](https://github.com/EamonnHegarty/laidir-infra).

## Stack

|                 |                                                                                   |
| --------------- | --------------------------------------------------------------------------------- |
| Expo SDK        | 58 (React Native 0.88, React 19.3), New Architecture, React Compiler              |
| Navigation      | Expo Router, native bottom tabs                                                   |
| Package manager | pnpm (`packageManager` in `package.json`)                                         |
| Checks          | Prettier, ESLint (`eslint-config-expo`), `tsc`, Jest (`jest-expo`), `expo-doctor` |
| Builds          | EAS Build (cloud): `development` dev client and `preview` APK                     |

## Develop

Requires Node ≥ 24.3 (see `.node-version`) and pnpm.

```bash
pnpm install
pnpm start          # dev server; open in the "Láidir (dev)" app on the phone (same Wi-Fi)
pnpm check          # format, lint, typecheck, tests, expo-doctor (what CI runs)
```

Add packages with `npx expo install <pkg>` so versions match the SDK.

## Builds and installing on the phone

Two app variants, chosen by `APP_VARIANT` in [`eas.json`](eas.json) and [`app.config.ts`](app.config.ts):

| Profile       | App          | Package                       | Use                                                                                          |
| ------------- | ------------ | ----------------------------- | -------------------------------------------------------------------------------------------- |
| `development` | Láidir (dev) | `ie.eamonnhegarty.laidir.dev` | Dev client: loads JS from `pnpm start` with hot reload. Rebuild only when native deps change |
| `preview`     | Láidir       | `ie.eamonnhegarty.laidir`     | Standalone APK for daily use, fully offline                                                  |

```bash
pnpm build:dev       # eas build --platform android --profile development
pnpm build:preview   # eas build --platform android --profile preview
```

Open the build link on the phone, download the APK and allow installs from that source. On Samsung, **Auto Blocker**
(Settings → Security and privacy) must be off to sideload. EAS keeps the signing key, so new APKs install over old ones.

## Upgrading Expo

Dependabot leaves Expo-managed packages alone. Upgrade the SDK by hand:

```bash
npx expo install expo@^<sdk> --fix
pnpm check
```
