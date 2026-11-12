// mathra for Google Docs and Slides: the menu, the sidebar, and the equation put in the document as
// an image, with what a screen reader says as its alt text and its LaTeX in its link (which opens it
// in mathra's editor on the web, and lets the sidebar take it back to edit).

const EDITOR = "https://matheusmota-dev-br.github.io/mathra/editor.html#latex=";
// the document's text is 11 pt: an equation's em, in pixels (Docs) and points (Slides)
const EM_PX = 14.67;
const EM_PT = 18;

function onOpen() {
  ui().createAddonMenu().addItem("Insert equation", "showSidebar").addToUi();
}

function onInstall(e) {
  onOpen(e);
}

function inDocs() {
  try {
    return !!DocumentApp.getActiveDocument();
  } catch (_) {
    return false;
  }
}

function ui() {
  return inDocs() ? DocumentApp.getUi() : SlidesApp.getUi();
}

function showSidebar() {
  ui().showSidebar(HtmlService.createHtmlOutputFromFile("Sidebar").setTitle("mathra"));
}

/** The LaTeX an equation's link carries, or "". */
function latexOf(url) {
  return url && url.indexOf(EDITOR) === 0 ? decodeURIComponent(url.slice(EDITOR.length)) : "";
}

/** The equation image selected in the document, if any. */
function selectedImage() {
  if (inDocs()) {
    const selection = DocumentApp.getActiveDocument().getSelection();
    if (!selection) return null;
    for (const range of selection.getRangeElements()) {
      const el = range.getElement();
      if (el.getType() === DocumentApp.ElementType.INLINE_IMAGE && latexOf(el.asInlineImage().getLinkUrl())) return el.asInlineImage();
    }
    return null;
  }
  const range = SlidesApp.getActivePresentation().getSelection().getPageElementRange();
  if (!range) return null;
  for (const el of range.getPageElements()) {
    if (el.getPageElementType() === SlidesApp.PageElementType.IMAGE) {
      const link = el.asImage().getLink();
      if (link && latexOf(link.getUrl())) return el.asImage();
    }
  }
  return null;
}

/** What the sidebar starts from: the account's language and the selected equation's LaTeX. */
function getContext() {
  const image = selectedImage();
  const url = image ? (inDocs() ? image.getLinkUrl() : image.getLink().getUrl()) : "";
  return { locale: Session.getActiveUserLocale(), latex: latexOf(url) };
}

/** Puts the equation in the document: over the selected one, or at the cursor (Docs) or on the slide (Slides). */
function insertEquation(eq) {
  const blob = Utilities.newBlob(Utilities.base64Decode(eq.png), "image/png", "equation.png");
  const link = EDITOR + encodeURIComponent(eq.latex);
  const old = eq.replace ? selectedImage() : null;
  if (inDocs()) {
    let image;
    if (old) {
      const parent = old.getParent();
      image = parent.insertInlineImage(parent.getChildIndex(old), blob);
      old.removeFromParent();
    } else {
      const cursor = DocumentApp.getActiveDocument().getCursor();
      image = cursor && cursor.insertInlineImage(blob);
      if (!image) throw new Error("Put the cursor in the text where the equation goes.");
    }
    image.setWidth(Math.round(eq.em.width * EM_PX)).setHeight(Math.round(eq.em.height * EM_PX));
    image.setAltTitle("Equation").setAltDescription(eq.alt).setLinkUrl(link);
    return;
  }
  const slide = SlidesApp.getActivePresentation().getSelection().getCurrentPage();
  const image = old ? old.replace(blob) : slide.insertImage(blob);
  image.setWidth(eq.em.width * EM_PT).setHeight(eq.em.height * EM_PT);
  image.setTitle("Equation").setDescription(eq.alt).setLinkUrl(link);
}
