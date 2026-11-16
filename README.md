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

## Data

Everything is stored on the phone in SQLite ([`src/data/`](src/data)). Each item is kept as the exact
laidir-api v1 JSON document (exercises, routine folders, routines, workouts), so phase 3 sync pushes and pulls the
same documents. Tests run the data layer against real SQLite (`node:sqlite`) and validate every stored document
against the contract's JSON Schemas.

| Path                                                   | What                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [`contract.json`](contract.json)                       | The laidir-api commit this app is built against                                            |
| [`contract/`](contract)                                | Synced copy of the bundled OpenAPI spec, `schemas/v1/` and the built-in exercise catalogue |
| [`src/generated/openapi.ts`](src/generated/openapi.ts) | Types generated from the spec                                                              |
| [`src/data/migrations.ts`](src/data/migrations.ts)     | Append-only SQLite migrations (`PRAGMA user_version`)                                      |

To move to a newer contract, set `ref` in `contract.json` to a laidir-api commit SHA, then run
`pnpm contract:sync` and commit the changes. CI fails if the committed files don't match the pinned ref.

Rules from the contract that the app relies on: deleted items are tombstones (`deleted_at`), never removed, so
history keeps a deleted custom exercise's name; deleting a routine folder unfiles its routines; a `folder_id` that
points at a missing or deleted folder counts as unfiled; weights are stored in kg at full precision.

## Back up & sync (optional)

Signing in is optional: without an account everything stays on the phone. Settings → **Back up & sync** opens
Cognito's sign-in page in the system browser (authorization code + PKCE, [`src/auth/`](src/auth)); tokens live in
`expo-secure-store` and the access token is refreshed through `/oauth2/token` (refresh tokens rotate).

| Path                                                 | What                                                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`src/data/sync.ts`](src/data/sync.ts)               | Local side: account link, dirty items, applying pulled items (last writer wins), the Profile |
| [`src/data/sync-engine.ts`](src/data/sync-engine.ts) | One sync: push dirty items (≤ 25 per request), then pull pages from the stored cursor        |
| [`src/sync/`](src/sync)                              | API client, controller (when to sync, backoff) and the React provider                        |

- Sync runs at start, when the app returns to the foreground, 20 s after the last local edit, and on "Sync now".
- At first sign-in the settings become the account's Profile (keys starting `local_` stay on the phone). If the
  account already has a Profile (another phone), that one wins.
- The phone's data belongs to the first account that signs in on it; another account must erase it first.
- Tests run the engine against real SQLite and an in-memory server with the API's rules
  ([`fake-server.ts`](src/data/test-support/fake-server.ts)).

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
pnpm build:dev       # npx eas-cli@27.10.0 build --platform android --profile development
pnpm build:preview   # npx eas-cli@27.10.0 build --platform android --profile preview
```

The dev client uses the URL scheme `laidir-dev` and the preview app `laidir`, so Cognito's
`laidir://auth/callback` redirect always opens the real app.

### Over-the-air updates (EAS Update)

Preview builds include `expo-updates` (channel `preview`, runtime version from the native fingerprint). A JS-only
change reaches the installed app without a new build; it downloads on the next launch and applies on the one after:

```bash
npx eas-cli@27.10.0 update --channel preview --environment preview --message "what changed"
```

Anything that changes native code (a new native module, permissions, plugins) changes the fingerprint, so it needs
a new build; updates never reach a build they aren't compatible with.

Open the build link on the phone, download the APK and allow installs from that source. On Samsung, **Auto Blocker**
(Settings → Security and privacy) must be off to sideload. EAS keeps the signing key, so new APKs install over old ones.

## Upgrading Expo

Dependabot leaves Expo-managed packages alone. Upgrade the SDK by hand:

```bash
npx expo install expo@^<sdk> --fix
pnpm check
```
