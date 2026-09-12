//  去重合并功能
function uniqueBy<T, K>(items: T[], getKey: (item: T) => K): T[] {
  const map = new Map<K, T>();

  for (const item of items) {
    map.set(getKey(item), item);
  }

  return [...map.values()];
}
export { uniqueBy };
