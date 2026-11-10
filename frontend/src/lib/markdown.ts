const HTML_TAG = /<\/?(?:b|strong|i|em|u|ul|ol|li|p|br|div|script|style)\b/i;

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderInline(value: string) {
  let html = escapeHtml(value);
  html = html.replace(/\+\+(.+?)\+\+/g, "<u>$1</u>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return html;
}

export function markdownToHtml(markdown: string) {
  const lines = (markdown || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };
  lines.forEach((line) => {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${renderInline(bullet[1])}</li>`);
      return;
    }
    if (numbered) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${renderInline(numbered[1])}</li>`);
      return;
    }
    closeList();
    if (line.trim()) out.push(`<div>${renderInline(line)}</div>`);
  });
  closeList();
  return out.join("");
}

function renderNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "ul" || tag === "ol") {
    const items = Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child, index) => {
        const text = renderChildren(child).replace(/\n+/g, " ").trim();
        return tag === "ol" ? `${index + 1}. ${text}` : `- ${text}`;
      });
    return `${items.join("\n")}\n`;
  }
  const inner = renderChildren(element);
  if (tag === "b" || tag === "strong") return `**${inner}**`;
  if (tag === "i" || tag === "em") return `*${inner}*`;
  if (tag === "u") return `++${inner}++`;
  if (tag === "div" || tag === "p" || tag === "li") return `${inner}\n`;
  return inner;
}

function renderChildren(node: Node) {
  return Array.from(node.childNodes).map((child) => renderNode(child)).join("");
}

export function htmlToMarkdown(html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";
  return renderChildren(root)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function looksLikeHtml(value: string) {
  return HTML_TAG.test(value || "");
}
