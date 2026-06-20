// Runtime application configuration.
//
// Values are resolved in this order:
//   1. `window.__APP_CONFIG__` — injected at *deploy* time by the CDK
//      FrontendStack (see infra/lib/frontend-stack.ts), served as /config.js.
//   2. `import.meta.env.VITE_*` — baked in at *build* time, used for local dev.
//
// This indirection exists because the Cognito domain / client id are created
// by CDK and are not known when the frontend is built in CI. Reading them at
// runtime lets the same static bundle be deployed against any environment
// without a rebuild.

interface AppConfig {
  cognitoDomain: string;
  cognitoClientId: string;
}

const runtime =
  (window as unknown as { __APP_CONFIG__?: Partial<AppConfig> })
    .__APP_CONFIG__ ?? {};

export const cognitoDomain: string =
  runtime.cognitoDomain || import.meta.env.VITE_COGNITO_DOMAIN || "";

export const cognitoClientId: string =
  runtime.cognitoClientId || import.meta.env.VITE_COGNITO_CLIENT_ID || "";

export const isCognitoConfigured = Boolean(cognitoDomain && cognitoClientId);
