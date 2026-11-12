// The extension's service worker: "Open … in mathra" in the menu of a text selection, which opens the
// selected LaTeX in mathra's editor, in a window of its own.

/** The selection without the delimiters around it: $…$, $$…$$, \(…\), \[…\]. */
export function bare(text: string): string {
  const t = text.trim();
  for (const [open, close] of [["$$", "$$"], ["\\[", "\\]"], ["\\(", "\\)"], ["$", "$"]]) {
    if (t.length > open.length + close.length && t.startsWith(open) && t.endsWith(close)) return t.slice(open.length, -close.length).trim();
  }
  return t;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "mathra-open", title: chrome.i18n.getMessage("openSelection"), contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== "mathra-open") return;
  const url = chrome.runtime.getURL(`editor.html#window&latex=${encodeURIComponent(bare(info.selectionText ?? ""))}`);
  chrome.windows.create({ url, type: "popup", width: 1000, height: 700 });
});
