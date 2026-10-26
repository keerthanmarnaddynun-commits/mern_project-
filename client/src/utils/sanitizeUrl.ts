export function getSafeExternalUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}
