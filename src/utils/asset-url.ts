export function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}assets/${relativePath}`;
}
