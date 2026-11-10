"use client";

import { useEffect, useRef } from "react";
import { fieldClass } from "@/constants/ui";
import { htmlToMarkdown, looksLikeHtml, markdownToHtml } from "@/lib/markdown";

const ALLOWED = new Set(["b", "strong", "i", "em", "u", "ul", "ol", "li", "p", "br", "div"]);

const COMMANDS: { command: string; label: string; className: string }[] = [
  { command: "bold", label: "B", className: "font-bold" },
  { command: "italic", label: "I", className: "italic" },
  { command: "underline", label: "U", className: "underline" },
  { command: "insertUnorderedList", label: "• List", className: "" },
  { command: "insertOrderedList", label: "1. List", className: "" },
];

export const richTextClass =
  "rich-text [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

export function safeHtml(value: string) {
  const doc = new DOMParser().parseFromString(value, "text/html");
  const clean = document.createElement("div");
  const append = (source: Node, target: Node) => {
    source.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.textContent ?? ""));
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();
      if (!ALLOWED.has(tag)) {
        append(element, target);
        return;
      }
      const next = document.createElement(tag);
      append(element, next);
      target.appendChild(next);
    });
  };
  append(doc.body, clean);
  return clean.innerHTML;
}

export function visibleText(value: string) {
  const html = looksLikeHtml(value) ? safeHtml(value) : markdownToHtml(value);
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\u00a0/g, " ").trim();
}

type RichTextEditorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ id, value, onChange, placeholder }: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = ref.current;
    if (!editor || document.activeElement === editor) return;
    const html = looksLikeHtml(value) ? safeHtml(value) : markdownToHtml(value);
    if (editor.innerHTML !== html) editor.innerHTML = html;
  }, [value]);

  const publish = () => {
    onChange(htmlToMarkdown(ref.current?.innerHTML ?? ""));
  };

  const run = (command: string) => {
    ref.current?.focus();
    document.execCommand(command);
    publish();
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-700">
        {COMMANDS.map((item) => (
          <button
            key={item.command}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(item.command)}
            className={`rounded px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 ${item.className}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={id}
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className={`${fieldClass} ${richTextClass} min-h-24 rounded-none border-0 focus:ring-0`}
        onInput={publish}
      />
    </div>
  );
}

export function RichText({ markdown, className = "" }: { markdown: string; className?: string }) {
  const html = looksLikeHtml(markdown) ? safeHtml(markdown) : markdownToHtml(markdown);
  return <div className={`${richTextClass} ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
