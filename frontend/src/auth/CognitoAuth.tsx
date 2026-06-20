import React, { createContext, useContext, useEffect, useState } from "react";
import {
  cognitoClientId as CLIENT_ID,
  cognitoDomain as COGNITO_DOMAIN,
  isCognitoConfigured,
} from "../config";

interface AuthContextValue {
  token: string | null;
  sub: string | null;
  email: string | null;
  login: () => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  sub: null,
  email: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

/** Best-effort read of the `email` claim from a Cognito id_token JWT. */
function emailFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.email ?? payload["cognito:username"] ?? null;
  } catch {
    return null;
  }
}

const REDIRECT_URI = window.location.origin + "/callback";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("id_token")
  );
  const [sub, setSub] = useState<string | null>(
    localStorage.getItem("user_sub")
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      exchangeCode(code).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  async function exchangeCode(code: string) {
    if (!COGNITO_DOMAIN || !CLIENT_ID) return;
    try {
      const resp = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          code,
        }),
      });
      const data = await resp.json();
      if (data.id_token) {
        localStorage.setItem("id_token", data.id_token);
        setToken(data.id_token);
        // Decode sub from JWT payload
        const payload = JSON.parse(atob(data.id_token.split(".")[1]));
        localStorage.setItem("user_sub", payload.sub);
        setSub(payload.sub);
        window.history.replaceState({}, "", "/");
      }
    } catch (e) {
      console.error("Token exchange failed", e);
    }
  }

  function login() {
    if (!isCognitoConfigured) {
      console.error(
        "Cognito is not configured: missing cognitoDomain / cognitoClientId. " +
          "In production these come from /config.js (injected by the CDK " +
          "FrontendStack); for local dev set VITE_COGNITO_DOMAIN and " +
          "VITE_COGNITO_CLIENT_ID."
      );
      return;
    }
    window.location.href =
      `${COGNITO_DOMAIN}/login?response_type=code` +
      `&client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&scope=openid+email`;
  }

  function logout() {
    localStorage.removeItem("id_token");
    localStorage.removeItem("user_sub");
    setToken(null);
    setSub(null);
    if (COGNITO_DOMAIN && CLIENT_ID) {
      window.location.href =
        `${COGNITO_DOMAIN}/logout?client_id=${CLIENT_ID}` +
        `&logout_uri=${encodeURIComponent(window.location.origin)}`;
    }
  }

  return (
    <AuthContext.Provider
      value={{ token, sub, email: emailFromToken(token), login, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
