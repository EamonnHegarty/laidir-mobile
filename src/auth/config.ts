/**
 * Cognito and API settings for the prod environment (laidir-infra outputs; none are secrets).
 * See the shared context, section 5.
 */
export const AUTH_DOMAIN = "https://laidir-prod-4d9359.auth.eu-west-1.amazoncognito.com";
export const CLIENT_ID = "2hseg8a46s9a6p451nr8or7719";
/** Registered on the mobile app client (the preview/production app's `laidir` scheme). */
export const REDIRECT_URI = "laidir://auth/callback";
export const LOGOUT_URI = "laidir://auth/logout";
export const SCOPES = ["openid", "email", "profile"];

export const API_BASE = "https://yqyk3qt5b8.execute-api.eu-west-1.amazonaws.com";

export const discovery = {
  authorizationEndpoint: `${AUTH_DOMAIN}/oauth2/authorize`,
  tokenEndpoint: `${AUTH_DOMAIN}/oauth2/token`,
  revocationEndpoint: `${AUTH_DOMAIN}/oauth2/revoke`,
  endSessionEndpoint: `${AUTH_DOMAIN}/logout`,
};
