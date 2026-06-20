import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders assistant markdown with the prototype's typographic styling. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[14.5px] leading-[1.6] text-[#1d2731]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <b className="font-bold">{children}</b>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 mt-1 flex flex-col gap-3 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 mt-1 flex flex-col gap-3 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="flex gap-2.5">
              <span className="mt-2 h-[7px] w-[7px] flex-none rounded-full bg-brand" />
              <span className="min-w-0">{children}</span>
            </li>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-brand underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-[#f1f3f6] px-1.5 py-0.5 font-mono text-[13px]">
              {children}
            </code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
