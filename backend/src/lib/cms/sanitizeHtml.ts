/**
 * Sanitize HTML for CMS rich-text storage/display (XSS-safe allowlist).
 */
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "a",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "span",
];

export function sanitizeCmsHtml(dirty: string): string {
  return sanitizeHtml(dirty ?? "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      "*": ["class"],
    },
  });
}

/** True when HTML has visible text content. */
export function htmlHasText(html: string): boolean {
  const text = sanitizeCmsHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0;
}
