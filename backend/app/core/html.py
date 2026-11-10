import html
import re
from html.parser import HTMLParser

from app.core.exceptions import BadRequestException

_ALLOWED = {"b", "strong", "i", "em", "u", "ul", "ol", "li", "p", "br", "div"}
_SKIP = {"script", "style"}
_VOID = {"br"}


class _Sanitizer(HTMLParser):
    """Keep a small set of formatting tags and drop everything else."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in _SKIP:
            self.skip += 1
            return
        if self.skip or tag not in _ALLOWED:
            return
        self.parts.append(f"<{tag}>")
        if tag not in _VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in _SKIP and self.skip:
            self.skip -= 1
            return
        if tag not in self.stack:
            return
        while self.stack:
            opened = self.stack.pop()
            self.parts.append(f"</{opened}>")
            if opened == tag:
                break

    def handle_data(self, data: str) -> None:
        if self.skip or not data:
            return
        self.parts.append(html.escape(data))

    def close_open_tags(self) -> None:
        while self.stack:
            self.parts.append(f"</{self.stack.pop()}>")


def clean_html(value: str) -> str:
    """Return the fragment with only the allowed formatting tags."""
    parser = _Sanitizer()
    parser.feed(value or "")
    parser.close()
    parser.close_open_tags()
    return "".join(parser.parts).strip()


def sanitize_rich_text(value: str) -> str:
    """Return safe HTML, or reject a comment that has no visible text."""
    cleaned = clean_html(value)
    visible = re.sub(r"<[^>]+>", "", cleaned).replace("\xa0", " ").strip()
    if not visible:
        raise BadRequestException("Write a comment")
    if len(cleaned) > 20000:
        raise BadRequestException("Comment is too long")
    return cleaned
