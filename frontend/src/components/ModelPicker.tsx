const MODELS = [
  {
    id: "anthropic.claude-3-haiku-20240307-v1:0",
    label: "Claude 3 Haiku (fast)",
  },
  {
    id: "anthropic.claude-3-5-sonnet-20241022-v2:0",
    label: "Claude 3.5 Sonnet (smart)",
  },
];

interface Props {
  value: string;
  onChange: (model: string) => void;
}

export default function ModelPicker({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-700 text-white text-sm rounded-lg px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {MODELS.map((m) => (
        <option key={m.id} value={m.id}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
