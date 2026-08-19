/**
 * Sanitize HTML for CMS rich-text storage/display (XSS-safe allowlist).
 */
import DOMPurify from "isomorphic-dompurify";

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

const ALLOWED_ATTR = ["href", "target", "rel", "class"];

export function sanitizeCmsHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
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
