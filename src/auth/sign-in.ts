import { AuthRequest, exchangeCodeAsync } from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";

import { CLIENT_ID, LOGOUT_URI, REDIRECT_URI, SCOPES, discovery } from "./config";
import { createSession, type SessionAccount, type TokenStorage } from "./session";

// Closes the auth popup on web; a no-op on Android.
WebBrowser.maybeCompleteAuthSession();

const secureStorage: TokenStorage = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  delete: (key) => SecureStore.deleteItemAsync(key),
};

/** The app's one session. */
export const session = createSession({ storage: secureStorage });

export type SignInResult =
  | { type: "success"; account: SessionAccount }
  | { type: "cancel" }
  | { type: "error"; message: string };

/**
 * Opens Cognito's sign-in page in the system browser (authorization code + PKCE), then exchanges
 * the code for tokens. The app never sees the password.
 */
export async function signIn(): Promise<SignInResult> {
  const request = new AuthRequest({
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
    usePKCE: true,
  });
  const result = await request.promptAsync(discovery);
  if (result.type === "cancel" || result.type === "dismiss") return { type: "cancel" };
  if (result.type !== "success") {
    const message =
      result.type === "error"
        ? (result.error?.description ?? result.error?.message ?? "Sign-in failed.")
        : "Sign-in didn't finish.";
    return { type: "error", message };
  }
  const code = result.params.code;
  if (!code || !request.codeVerifier) return { type: "error", message: "No sign-in code." };
  try {
    const tokens = await exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code,
        redirectUri: REDIRECT_URI,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    );
    const account = await session.signedIn(tokens);
    return { type: "success", account };
  } catch (error) {
    return { type: "error", message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Signs out: revokes the refresh token, forgets the tokens, and ends Cognito's browser session so
 * the next sign-in asks for the account again (best effort; closing the browser is fine).
 */
export async function signOut(): Promise<void> {
  await session.signOut();
  const url = `${discovery.endSessionEndpoint}?client_id=${encodeURIComponent(CLIENT_ID)}&logout_uri=${encodeURIComponent(LOGOUT_URI)}`;
  try {
    await WebBrowser.openAuthSessionAsync(url, LOGOUT_URI);
  } catch {
    // No browser session to end.
  }
}
