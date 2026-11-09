// Client-safe: no content imports, so the palette stays small.

export interface SearchItem {
  type: "System" | "Component" | "Concept";
  title: string;
  subtitle: string;
  href: string;
  /** Extra text that should match but isn't shown (service names, concept names …). */
  keywords: string;
}

const toWords = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
const hasWordStartingWith = (words: string[], prefix: string) => words.some((w) => w.startsWith(prefix));

/** Every query word must start some word in the item; title matches rank highest. */
export function searchItems(items: SearchItem[], query: string, limit = 12): SearchItem[] {
  const terms = toWords(query);
  if (terms.length === 0) return [];

  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const titleWords = toWords(item.title);
    const keywordWords = toWords(item.keywords);
    const allWords = [...titleWords, ...toWords(item.subtitle), ...keywordWords];
    if (!terms.every((t) => hasWordStartingWith(allWords, t))) continue;

    let score = 0;
    for (const t of terms) {
      if (titleWords[0]?.startsWith(t)) score += 4;
      else if (hasWordStartingWith(titleWords, t)) score += 2;
      else if (hasWordStartingWith(keywordWords, t)) score += 1;
    }
    if (item.type === "System") score += 0.5;
    scored.push({ item, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map((s) => s.item);
}
