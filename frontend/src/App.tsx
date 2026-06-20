import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/CognitoAuth";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";

function AppRoutes() {
  const { token, isLoading } = useAuth();
  const devSub = import.meta.env.VITE_DEV_SUB;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-ink-faint">Laddar…</div>
      </div>
    );
  }

  const isAuthenticated = Boolean(token || devSub);

  return (
    <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <ChatPage /> : <LoginPage />}
      />
      <Route
        path="/callback"
        element={isAuthenticated ? <ChatPage /> : <LoginPage />}
      />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
