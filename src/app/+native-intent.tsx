/**
 * Cognito redirects back to laidir://auth/callback (sign-in) and laidir://auth/logout (sign-out).
 * expo-auth-session / expo-web-browser pick those up; this stops Expo Router from also trying to
 * open them as screens (there are none), and returns to Settings where sign-in started.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    if (/^(laidir:\/\/|\/)?auth\/(callback|logout)/.test(path)) return "/profile/settings";
  } catch {
    // Fall through to normal handling.
  }
  return path;
}
