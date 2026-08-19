const HTML_ENTITY: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function productCopyToPlainText(value: string | null | undefined) {
  if (!value) return "";
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6])\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
      if (key.startsWith("#")) {
        const codePoint = Number.parseInt(
          key.slice(key[1].toLowerCase() === "x" ? 2 : 1),
          key[1].toLowerCase() === "x" ? 16 : 10,
        );
        return codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
      }
      return HTML_ENTITY[key.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}
