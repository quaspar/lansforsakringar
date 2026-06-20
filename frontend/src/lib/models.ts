export interface ModelOption {
  id: string;
  label: string;
  description: string;
  provider: string;
  /** Color dot shown next to the model / in the top-bar pill. */
  dot: string;
}

// Only the models the backend actually allows (see services/chat-api config.py
// `allowed_models`). All are served through Amazon Bedrock via the Converse API,
// which is why several providers can coexist here.
export const MODELS: ModelOption[] = [
  {
    id: "anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5",
    description: "Snabb · vardagsfrågor",
    provider: "Anthropic",
    dot: "#d97757",
  },
  {
    id: "anthropic.claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    description: "Stark på resonemang & text",
    provider: "Anthropic",
    dot: "#d97757",
  },
  {
    id: "meta.llama3-3-70b-instruct-v1:0",
    label: "Llama 3.3 70B",
    description: "Öppen modell · mångsidig",
    provider: "Meta",
    dot: "#4267b2",
  },
  {
    id: "openai.gpt-oss-120b-1:0",
    label: "GPT-oss 120B",
    description: "Öppen modell · bred kunskap",
    provider: "OpenAI",
    dot: "#10a37f",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export function modelDot(id: string): string {
  return MODELS.find((m) => m.id === id)?.dot ?? "#d97757";
}
