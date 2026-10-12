export function mergeFreshItems<T extends { id: string; createdAt: Date; hasPhoto: boolean }>(
  items: readonly T[],
  limit = 6,
): T[] {
  return [...items]
    .sort((left, right) => {
      const photo = Number(right.hasPhoto) - Number(left.hasPhoto);
      if (photo !== 0) return photo;
      const time = right.createdAt.getTime() - left.createdAt.getTime();
      if (time !== 0) return time;
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    })
    .slice(0, limit);
}

/**
 * Occasion rows keep their slugs and titles. The funerals slug is never the
 * first tile when any other occasion is present.
 */
export function occasionTileOrder<T extends { slug: string }>(tiles: readonly T[]): T[] {
  const leading: T[] = [];
  const trailing: T[] = [];
  for (const tile of tiles) {
    if (tile.slug === "funerals") trailing.push(tile);
    else leading.push(tile);
  }
  if (leading.length === 0) return [...trailing];
  return [...leading, ...trailing];
}
