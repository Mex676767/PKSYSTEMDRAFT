// Pulls an image File out of a paste event's clipboard data, e.g. from an OS
// screenshot or a copied image in another app. Returns null for ordinary text
// pastes so callers can let those through unchanged.
export function imageFromClipboard(e: React.ClipboardEvent | ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.startsWith("image/")) {
      return items[i].getAsFile();
    }
  }
  return null;
}
