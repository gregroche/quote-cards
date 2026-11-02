// QUOTE CARDS — the extension's background script.
// Chrome runs this behind the scenes. It does three things:
//   1. Adds "Make quote card" to the right-click menu when text is highlighted,
//      with a submenu listing your brands.
//   2. When you click a brand, opens the card maker with the quote, source
//      and brand filled in.
//   3. On first install, opens the brand editor so you can add your brand.

// Private brands in brands/local/ (left out of Git), when that folder exists.
// Only their names and ids are used here, for the menu.
try {
  importScripts("brands/registry.js", "brands/local/index.js");
  importScripts(...LOCAL_BRAND_FILES.map((f) => "brands/local/" + f));
} catch (e) { /* no private brands */ }
const LOCAL_BRANDS = typeof BRANDS === "undefined" ? [] : BRANDS;

// 1. Build the menu: private brands, then the brands saved in the brand
// editor, then Plain.
// (Clear the old one first, or Chrome complains the items already exist.)
async function buildMenu() {
  const { brands = [] } = await chrome.storage.local.get("brands");
  const items = [
    ...LOCAL_BRANDS.map((b) => ({ id: b.id, title: b.name })),
    ...brands.map((b) => ({ id: b.id, title: b.name || "Untitled brand" })),
    { id: "plain", title: "Plain" },
  ];
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "make-quote-card",
      title: "Make quote card",
      contexts: ["selection"],   // only show it when text is highlighted
    });
    items.forEach((b) => {
      chrome.contextMenus.create({
        id: "brand:" + b.id,
        parentId: "make-quote-card",
        title: b.title,
        contexts: ["selection"],
      });
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  buildMenu();
  // 3. Brand new install: go straight to the brand editor.
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(buildMenu);

// Rebuild whenever a brand is added, renamed or deleted in the editor.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.brands) buildMenu();
});

// 2. A brand in the submenu was clicked.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!String(info.menuItemId).startsWith("brand:")) return;
  const brand = String(info.menuItemId).slice("brand:".length);

  // Chrome hands us the highlighted text, but with line breaks flattened.
  // Asking the page directly keeps them, and also lets us read who wrote it.
  let page = {};
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readPage,
    });
    page = result.result || {};
  } catch (err) {
    // Some pages refuse scripts (Chrome's own pages, the Web Store, PDFs).
    // Fall back to what the menu click gave us.
  }

  const text = (page.selection || info.selectionText || "").trim();
  const site = page.siteName || hostName(info.pageUrl);
  let source = site;
  if (page.author) {
    // Skip the site name when the author already includes it,
    // e.g. an author called "Jane-Example Weekly" on Example Weekly.
    const repeats = page.author.toLowerCase().includes(site.toLowerCase());
    source = repeats ? page.author : `${page.author}, ${site}`;
  }

  // The link to share alongside the card. Prefer the page's own "canonical"
  // address (the version the site considers official), then tidy it.
  const url = cleanLink(page.canonical || info.pageUrl);

  openCardMaker({ text, source, brand, url });
});

// Clicking the toolbar icon opens a blank card maker.
chrome.action.onClicked.addListener(() => openCardMaker({}));

function openCardMaker(fields) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  chrome.tabs.create({
    url: chrome.runtime.getURL("card-maker.html") + (query ? "?" + query : ""),
  });
}

// Strip the parts of a link that track you or point back to your inbox,
// so what you share is the plain article address.
//   - utm_..., fbclid, gclid: ad and campaign tracking
//   - smid: New York Times share tracking
//   - mc_cid, mc_eid: Mailchimp email tracking
//   - r, token, isFreemail, triedRedirect, publication_id, post_id:
//     Substack email and referral codes (token can be tied to your account)
//   - #...: jump-to-spot markers, including Chrome's highlight links
const TRACKING_PARAMS = ["fbclid", "gclid", "smid", "mc_cid", "mc_eid", "r", "token",
  "isFreemail", "triedRedirect", "publication_id", "post_id"];

function cleanLink(link) {
  try {
    const u = new URL(link);
    if (!/^https?:$/.test(u.protocol)) return "";   // nothing shareable on chrome:// or file:// pages
    [...u.searchParams.keys()].forEach((key) => {
      if (key.startsWith("utm_") || TRACKING_PARAMS.includes(key)) u.searchParams.delete(key);
    });
    u.hash = "";
    return u.toString();
  } catch (e) {
    return "";
  }
}

// "www.example.com" -> "example.com"
function hostName(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch (e) { return ""; }
}

// This function runs INSIDE the web page, not here, so it can only use what
// the page has. It reads the selection and the page's own labels for its
// site name and author. Pages label these two ways:
//   - <meta> tags in the page header (most news sites)
//   - "structured data", a block of JSON meant for search engines (Substack,
//     and many news sites too)
// Plenty of pages have neither, which is why everything falls back.
function readPage() {
  const meta = (selector) => {
    const el = document.querySelector(selector);
    return el ? (el.getAttribute("content") || "").trim() : "";
  };

  // Structured data: look for an article and pull its author and publisher.
  let ldAuthor = "", ldPublisher = "";
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      const data = JSON.parse(s.textContent);
      const items = Array.isArray(data) ? data : data["@graph"] || [data];
      items.forEach((item) => {
        const author = Array.isArray(item.author) ? item.author[0] : item.author;
        if (!ldAuthor && author) ldAuthor = typeof author === "string" ? author : author.name || "";
        const pub = item.publisher;
        if (!ldPublisher && pub) ldPublisher = typeof pub === "string" ? pub : pub.name || "";
      });
    } catch (e) { /* badly formed JSON on the page; ignore it */ }
  });

  let author =
    meta('meta[name="author"]') ||
    meta('meta[property="article:author"]') ||
    ldAuthor;
  // Some sites put a link here instead of a name. A link isn't useful on a card.
  if (/^https?:\/\//.test(author)) author = "";

  const canonical = document.querySelector('link[rel="canonical"]');

  return {
    selection: window.getSelection().toString(),
    siteName: meta('meta[property="og:site_name"]') || ldPublisher,
    author: author.trim(),
    canonical: canonical ? canonical.href : "",
  };
}
