import Composer from "./Composer";
import { greeting } from "../lib/format";

interface Props {
  name: string;
  model: string;
  input: string;
  onChange: (v: string) => void;
  onSend: () => void;
}

const SUGGESTIONS = [
  {
    title: "Sammanfatta mitt försäkringsbrev",
    sub: "Klistra in texten så lyfter jag det viktigaste.",
  },
  {
    title: "Vad täcker min hemförsäkring?",
    sub: "Förstå skydd, självrisk och undantag.",
  },
  {
    title: "Hjälp mig jämföra bolån",
    sub: "Ränta, bindningstid och månadskostnad.",
  },
  {
    title: "Skriv ett mejl till min handläggare",
    sub: "Beskriv ärendet så formulerar jag det.",
  },
];

export default function EmptyState({
  name,
  model,
  input,
  onChange,
  onSend,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center">
      <div className="mx-auto flex w-full max-w-[720px] flex-col items-center px-4 py-6 sm:px-7">
        <div className="mb-5 flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-brand shadow-[0_6px_18px_rgba(16,24,40,.16)]">
          <span className="text-[24px] text-white">✦</span>
        </div>
        <div className="text-[28px] font-extrabold tracking-[-.02em]">
          {greeting()}, {name}
        </div>
        <div className="mt-2 text-[15px] text-[#7d8794]">
          Vad kan jag hjälpa dig med idag?
        </div>

        <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => onChange(s.title)}
              className="rounded-[14px] border border-line bg-white px-4 py-[15px] text-left transition hover:border-brand hover:shadow-[0_3px_12px_rgba(16,24,40,.07)]"
            >
              <div className="text-[14px] font-semibold">{s.title}</div>
              <div className="mt-1 text-[12.5px] leading-[1.45] text-ink-faint">
                {s.sub}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-[22px] w-full">
          <Composer
            value={input}
            onChange={onChange}
            onSend={onSend}
            model={model}
            placeholder="Ställ en fråga…"
            showHints={false}
          />
        </div>
      </div>
    </div>
  );
}
