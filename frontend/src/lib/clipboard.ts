/** Clipboard API requires HTTPS; the LAN deployment also supports HTTP. */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* Continue with the user-gesture fallback on HTTP/LAN or denied permission. */
    }
  }
  const previous = document.activeElement as HTMLElement | null,
    selection = document.getSelection(),
    ranges = selection
      ? Array.from({ length: selection.rangeCount }, (_, i) =>
          selection.getRangeAt(i).cloneRange(),
        )
      : [];
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.cssText = "position:fixed;left:-10000px;top:0;opacity:0";
  document.body.appendChild(field);
  field.select();
  try {
    if (!document.execCommand("copy"))
      throw new Error("浏览器未允许复制，请选择程序文本手动复制");
  } finally {
    field.remove();
    previous?.focus({ preventScroll: true });
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
  }
}
