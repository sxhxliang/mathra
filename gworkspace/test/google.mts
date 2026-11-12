// A stand-in for what Code.js uses of Apps Script: DocumentApp, SlidesApp, HtmlService, Session and
// Utilities, with a document or a presentation to act on. `google.reset("docs" | "slides")` picks the
// editor the add-on runs in; `google.calls` records what it did.

export const calls: unknown[][] = [];
const record = (...call: unknown[]) => calls.push(call);

type Image = Record<string, (...args: never[]) => unknown> & { link?: string };

/** A Docs inline image: its link, its size and alt text recorded, its paragraph to be replaced in. */
export function docsImage(link: string | null, parent?: unknown): Image {
  const img: Image = {
    getType: () => "INLINE_IMAGE",
    asInlineImage: () => img,
    getLinkUrl: () => link,
    getParent: () => parent,
    removeFromParent: () => record("removed", link),
    setWidth: (w: number) => (record("width", w), img),
    setHeight: (h: number) => (record("height", h), img),
    setAltTitle: (t: string) => (record("altTitle", t), img),
    setAltDescription: (d: string) => (record("altDescription", d), img),
    setLinkUrl: (u: string) => (record("link", u), img),
  };
  return img;
}

/** A Slides image: its link, and what replace and the setters did. */
export function slidesImage(link: string | null): Image {
  const img: Image = {
    getPageElementType: () => "IMAGE",
    asImage: () => img,
    getLink: () => (link === null ? null : { getUrl: () => link }),
    replace: (blob: unknown) => (record("replace", blob), img),
    setWidth: (w: number) => (record("width", w), img),
    setHeight: (h: number) => (record("height", h), img),
    setTitle: (t: string) => (record("title", t), img),
    setDescription: (d: string) => (record("description", d), img),
    setLinkUrl: (u: string) => (record("link", u), img),
  };
  return img;
}

export const state = {
  host: "docs" as "docs" | "slides",
  /** Docs: the selection's elements (null: nothing selected), the cursor (null: none) */
  selection: null as unknown[] | null,
  cursor: null as { insertInlineImage: (blob: unknown) => unknown } | null,
  /** Slides: the selected page elements (null: none) */
  pageElements: null as unknown[] | null,
};

export function reset(host: "docs" | "slides") {
  calls.length = 0;
  state.host = host;
  state.selection = null;
  state.cursor = null;
  state.pageElements = null;
}

const ui = (name: string) => ({
  createAddonMenu: () => {
    const menu = { addItem: (label: string, fn: string) => (record("menu", name, label, fn), menu), addToUi: () => record("addToUi", name) };
    return menu;
  },
  showSidebar: (html: { title: string; file: string }) => record("sidebar", name, html.file, html.title),
});

export const DocumentApp = {
  ElementType: { INLINE_IMAGE: "INLINE_IMAGE" },
  getActiveDocument: () => {
    // outside Docs, Apps Script throws here
    if (state.host !== "docs") throw new Error("no document");
    return {
      getSelection: () => (state.selection ? { getRangeElements: () => state.selection!.map((el) => ({ getElement: () => el })) } : null),
      getCursor: () => state.cursor,
    };
  },
  getUi: () => ui("docs"),
};

export const SlidesApp = {
  PageElementType: { IMAGE: "IMAGE" },
  getActivePresentation: () => ({
    getSelection: () => ({
      getPageElementRange: () => (state.pageElements ? { getPageElements: () => state.pageElements } : null),
      getCurrentPage: () => ({ insertImage: (blob: unknown) => (record("insertImage", blob), slidesImage(null)) }),
    }),
  }),
  getUi: () => ui("slides"),
};

export const HtmlService = {
  createHtmlOutputFromFile: (file: string) => {
    const html = { file, title: "", setTitle: (t: string) => ((html.title = t), html) };
    return html;
  },
};

export const Session = { getActiveUserLocale: () => "pt_BR" };

export const Utilities = {
  base64Decode: (b64: string) => `bytes(${b64})`,
  newBlob: (bytes: string, type: string, name: string) => ({ bytes, type, name }),
};
