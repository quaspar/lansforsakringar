import { useAuth } from "../auth/CognitoAuth";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-[18px] border border-line bg-white p-10 shadow-[0_24px_60px_rgba(16,24,40,.12)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-[15px] bg-brand shadow-[0_6px_18px_rgba(16,24,40,.16)]">
          <div className="h-[18px] w-[18px] rotate-45 rounded-[3px] bg-white" />
        </div>
        <div className="text-center">
          <h1 className="text-[22px] font-extrabold tracking-[-.01em]">
            Assistenten
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">Försäkring &amp; bank</p>
        </div>
        <p className="max-w-xs text-center text-[13.5px] leading-[1.55] text-ink-faint">
          Logga in för att börja en konversation med din försäkrings- och
          bankassistent.
        </p>
        <button
          onClick={login}
          className="w-full rounded-[11px] bg-brand px-8 py-3 text-[14px] font-semibold text-white shadow-[0_1px_3px_rgba(16,24,40,.18)] transition hover:bg-brand-strong"
        >
          Logga in med Cognito
        </button>
      </div>
    </div>
  );
}
