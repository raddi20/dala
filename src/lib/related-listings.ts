export type RelatedListing = {
  id: string;
  category: string;
  city: string;
  updatedAt: Date;
};

/**
 * Public listings that share this listing's category, its town, or both.
 * Same category and town come first, then category, then town.
 * Ties use the newer updatedAt, then id, so the order does not drift.
 */
export function selectRelatedListings<T extends RelatedListing>(
  current: { id: string; category: string; city: string },
  candidates: readonly T[],
  limit = 8,
): T[] {
  const category = current.category.trim();
  const city = current.city.trim();
  const ranked = candidates.filter((item) => {
    if (!item.id || item.id === current.id) return false;
    const sameCategory = Boolean(category) && item.category === category;
    const sameTown = Boolean(city) && item.city === city;
    return sameCategory || sameTown;
  });
  ranked.sort((a, b) => {
    const rank = relatedRank(current, a) - relatedRank(current, b);
    if (rank !== 0) return rank;
    const time = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (time !== 0) return time;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  const size = Math.max(0, Math.trunc(limit));
  return ranked.slice(0, size);
}

function relatedRank(current: { category: string; city: string }, item: RelatedListing) {
  const sameCategory = Boolean(current.category.trim()) && item.category === current.category.trim();
  const sameTown = Boolean(current.city.trim()) && item.city === current.city.trim();
  if (sameCategory && sameTown) return 0;
  if (sameCategory) return 1;
  return 2;
}
