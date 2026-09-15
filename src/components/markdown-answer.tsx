import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

interface MarkdownAnswerProps {
  content: string;
}

const normalizeMathDelimiters = (content: string) =>
  content
    // remark-math handles $...$/$$...$$. Convert common LaTeX delimiters first.
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, expression) => `$$${expression}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, expression) => `$${expression}$`);

export const MarkdownAnswer = ({ content }: MarkdownAnswerProps) => (
  <div className="markdown-answer text-sm leading-relaxed text-gray-700">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeSanitize, rehypeKatex]}
      components={{
        h1: ({ children }) => <h1 className="mt-5 mb-3 text-xl font-bold text-gray-900">{children}</h1>,
        h2: ({ children }) => <h2 className="mt-5 mb-2 text-lg font-bold text-gray-900">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-4 mb-2 text-base font-semibold text-gray-900">{children}</h3>,
        p: ({ children }) => <p className="my-3">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
        a: ({ children, href }) => (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-[#4a77b4] underline underline-offset-2"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
        ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-[#4a77b4] bg-blue-50 px-4 py-3 text-gray-700">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-5 border-gray-200" />,
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full border-collapse text-left text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-100 text-gray-800">{children}</thead>,
        tbody: ({ children }) => <tbody className="divide-y divide-gray-200 bg-white">{children}</tbody>,
        th: ({ children }) => <th className="border-b border-gray-200 px-3 py-2 font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 align-top text-gray-700">{children}</td>,
        code: ({ children, className }) => {
          const isBlock = Boolean(className);
          return isBlock ? (
            <code className={`${className} font-mono text-sm`}>{children}</code>
          ) : (
            <code className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-900">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-4 overflow-x-auto rounded border border-gray-200 bg-gray-900 p-4 text-gray-100">
            {children}
          </pre>
        ),
      }}
    >
      {normalizeMathDelimiters(content)}
    </ReactMarkdown>
  </div>
);
