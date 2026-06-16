import { useAuth } from "../auth/CognitoAuth";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-2xl">
        <h1 className="text-white text-3xl font-bold">AI Chat</h1>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          Sign in to start a conversation powered by AWS Bedrock.
        </p>
        <button
          onClick={login}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-8 py-3 font-medium transition-colors"
        >
          Sign in with Cognito
        </button>
      </div>
    </div>
  );
}
