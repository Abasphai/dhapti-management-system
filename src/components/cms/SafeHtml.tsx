import DOMPurify from "dompurify";

import { cn } from "@/lib/utils";

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

/** XSS-safe HTML renderer for published CMS rich text. */
export function SafeHtml({
  html,
  className,
  as: Tag = "div",
}: {
  html: string;
  className?: string;
  as?: "div" | "span" | "p" | "section";
}) {
  const clean = DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  if (!clean.trim()) return null;
  return (
    <Tag
      className={cn("cms-prose", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export function htmlHasVisibleText(html: string): boolean {
  const text = DOMPurify.sanitize(html ?? "", {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0;
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value ?? "");
}

/** Renders CMS text as SafeHtml when markup is present; otherwise plain text (fallback-safe). */
export function CmsText({
  value,
  className,
  asPlain = "p",
}: {
  value: string;
  className?: string;
  asPlain?: "p" | "div" | "span";
}) {
  if (!value?.trim()) return null;
  if (looksLikeHtml(value)) {
    return <SafeHtml html={value} className={className} />;
  }
  const Tag = asPlain;
  return <Tag className={className}>{value}</Tag>;
}
