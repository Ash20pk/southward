import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";

export function Markdown({ children, compact, className }: { children: string; compact?: boolean; className?: string }) {
  return (
    <div className={clsx("prose-sw", compact && "compact", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
