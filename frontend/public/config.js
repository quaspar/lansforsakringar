// Runtime configuration placeholder.
//
// In production this file is OVERWRITTEN at deploy time by the CDK
// FrontendStack with the real Cognito values. For local development the app
// falls back to import.meta.env (.env), so the empty strings here are fine.
window.__APP_CONFIG__ = {
  cognitoDomain: "",
  cognitoClientId: "",
};
