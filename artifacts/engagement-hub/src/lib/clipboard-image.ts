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
