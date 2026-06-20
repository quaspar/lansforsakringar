export interface ModelOption {
  id: string;
  label: string;
  description: string;
  provider: string;
  /** Color dot shown next to the model / in the top-bar pill. */
  dot: string;
}

// Only the models the backend actually allows (see services/chat-api config.py
// `allowed_models`). The prototype showed several providers, but the backend
// only supports Bedrock Anthropic models today.
export const MODELS: ModelOption[] = [
  {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    label: "Claude 3 Haiku",
    description: "Snabb · vardagsfrågor",
    provider: "Anthropic",
    dot: "#d97757",
  },
  {
    id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    label: "Claude 3.5 Sonnet",
    description: "Stark på resonemang & text",
    provider: "Anthropic",
    dot: "#d97757",
  },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function modelLabel(id: string): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

export function modelDot(id: string): string {
  return MODELS.find((m) => m.id === id)?.dot ?? "#d97757";
}
