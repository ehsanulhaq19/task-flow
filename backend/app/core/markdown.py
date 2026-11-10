"""Convert the task editor's rich text into a small Markdown subset."""

import re
from html.parser import HTMLParser

from app.core.html import clean_html

_HTML_TAG = re.compile(r"</?(?:b|strong|i|em|u|ul|ol|li|p|br|div|script|style)\b", re.IGNORECASE)


class _HtmlToMarkdown(HTMLParser):
    """Turn the allowed formatting tags into Markdown markers."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.lists: list[list[str | int]] = []

    def _break(self) -> None:
        if self.parts and not self.parts[-1].endswith("\n"):
            self.parts.append("\n")

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"b", "strong"}:
            self.parts.append("**")
        elif tag in {"i", "em"}:
            self.parts.append("*")
        elif tag == "u":
            self.parts.append("++")
        elif tag == "br":
            self.parts.append("\n")
        elif tag in {"p", "div"}:
            self._break()
        elif tag in {"ul", "ol"}:
            self._break()
            self.lists.append([tag, 0])
        elif tag == "li" and self.lists:
            kind, count = self.lists[-1]
            count = int(count) + 1
            self.lists[-1][1] = count
            self._break()
            self.parts.append(f"{count}. " if kind == "ol" else "- ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"b", "strong"}:
            self.parts.append("**")
        elif tag in {"i", "em"}:
            self.parts.append("*")
        elif tag == "u":
            self.parts.append("++")
        elif tag in {"p", "div", "li", "ul", "ol"}:
            self._break()
        if tag in {"ul", "ol"} and self.lists:
            self.lists.pop()

    def handle_data(self, data: str) -> None:
        if data:
            self.parts.append(data)


def html_to_markdown(value: str) -> str:
    """Convert a sanitized HTML fragment into Markdown."""
    parser = _HtmlToMarkdown()
    parser.feed(clean_html(value))
    parser.close()
    return "".join(parser.parts)


def normalize_markdown(value: str) -> str:
    """Store rich text as Markdown. Existing HTML comments are converted."""
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if _HTML_TAG.search(text):
        text = html_to_markdown(text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


def markdown_visible(value: str) -> str:
    """Return the words a person would see, without Markdown markers."""
    text = re.sub(r"\+\+|[*_]+", "", value or "")
    text = re.sub(r"(?m)^\s*(?:[-*]|\d+\.)\s+", "", text)
    return text.replace("\xa0", " ").strip()
