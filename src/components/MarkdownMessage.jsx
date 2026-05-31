import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export default function MarkdownMessage({ content }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      skipHtml
      components={{
        a({ href, children, ...props }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          );
        },
        table({ children, ...props }) {
          return (
            <div className="ai-markdown-table-wrap">
              <table {...props}>{children}</table>
            </div>
          );
        },
      }}
    >
      {content}
    </Markdown>
  );
}
