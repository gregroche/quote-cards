// BRAND STORE — shared by the card maker and the brand editor.
// Three jobs:
//   1. The list of fonts the editor offers.
//   2. Saving and loading the brands people make.
//   3. compileBrand(): turns the handful of choices made in the editor
//      (colors, fonts, logo) into the full brand the card maker draws with.

// ─────────────────────────────────────────────────────────────
// 1. FONTS
// All free Google Fonts. "axes" is the exact Google Fonts request for each
// one; a font that has no italic must not ask for one, or Google refuses the
// whole request. "bold" is the heaviest weight requested, used for labels.
// ─────────────────────────────────────────────────────────────
const FONT_CHOICES = [
  // Serif
  { name: "Source Serif 4",     kind: "serif", italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Lora",               kind: "serif", italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Merriweather",       kind: "serif", italic: true,  bold: 700, axes: "ital,wght@0,400;0,700;1,400;1,700" },
  { name: "Playfair Display",   kind: "serif", italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "EB Garamond",        kind: "serif", italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Cormorant Garamond", kind: "serif", italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Libre Baskerville",  kind: "serif", italic: true,  bold: 700, axes: "ital,wght@0,400;0,700;1,400" },
  // Sans
  { name: "Inter",              kind: "sans",  italic: false, bold: 600, axes: "wght@400;600;700" },
  { name: "Montserrat",         kind: "sans",  italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Poppins",            kind: "sans",  italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Open Sans",          kind: "sans",  italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Lato",               kind: "sans",  italic: true,  bold: 700, axes: "ital,wght@0,400;0,700;1,400;1,700" },
  { name: "Raleway",            kind: "sans",  italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  { name: "Work Sans",          kind: "sans",  italic: true,  bold: 600, axes: "ital,wght@0,400;0,600;1,400;1,600" },
  // Display (best for labels and short quotes)
  { name: "Oswald",             kind: "sans",  italic: false, bold: 600, axes: "wght@400;600;700" },
  { name: "Cinzel",             kind: "serif", italic: false, bold: 600, axes: "wght@400;600;700" },
  { name: "Bebas Neue",         kind: "sans",  italic: false, bold: 400, axes: "" },
  // Built into every computer, no download
  { name: "Georgia",            kind: "serif", italic: true,  bold: 700, builtIn: true },
  { name: "Arial",              kind: "sans",  italic: true,  bold: 700, builtIn: true },
];

function findFont(name) {
  return FONT_CHOICES.find((f) => f.name === name) || FONT_CHOICES.find((f) => f.name === "Georgia");
}

// What the canvas asks for: the font, then a safe fallback of the same kind.
function fontFamily(f) {
  return `"${f.name}", ${f.kind === "serif" ? "Georgia, serif" : "Arial, sans-serif"}`;
}

// ─────────────────────────────────────────────────────────────
// 2. SAVING AND LOADING
// Inside the extension, brands go in Chrome's own extension storage, which
// the right-click menu can also read. When the page is opened by
// double-clicking the file instead, they go in the browser's local storage.
// ─────────────────────────────────────────────────────────────
const HAS_CHROME_STORAGE = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

const BrandStore = {
  async load() {
    if (HAS_CHROME_STORAGE) {
      const saved = await chrome.storage.local.get("brands");
      return saved.brands || [];
    }
    try { return JSON.parse(localStorage.getItem("qc-brands") || "[]"); }
    catch (e) { return []; }
  },
  async save(list) {
    if (HAS_CHROME_STORAGE) return chrome.storage.local.set({ brands: list });
    try { localStorage.setItem("qc-brands", JSON.stringify(list)); }
    catch (e) { throw new Error("This browser won't save brands here. Use the extension instead."); }
  },
};

// A brand as the editor stores it. Every field the editor shows is here.
function newBrandSpec() {
  return {
    id: "b-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: "",
    backgrounds: ["#FFFFFF", "#222831"],
    accent: "#2A9D8F",
    anyColor: false,
    quoteFont: "Lora",
    quoteItalic: true,
    labelFont: "Montserrat",
    labelCaps: true,
    quoteMark: "accent",   // "accent" (solid accent color) or "faint" (see-through)
    rule: true,            // short accent line above the attribution
    logoLight: "",         // logo for light backgrounds (data URI)
    logoDark: "",          // optional logo for dark backgrounds
    logoWide: false,       // true when the logo is wider than it is tall
    footerName: "",        // optional text next to the logo
  };
}

// ─────────────────────────────────────────────────────────────
// 3. THE RECIPE: editor choices -> full brand
// ─────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// How different two colors look in brightness, on the 1–21 scale used for
// accessibility. 4.5 is comfortable for text; under about 2 is hard to see.
function contrast(a, b) {
  const lum = (hex) => {
    const [r, g, bl] = hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function compileBrand(spec) {
  const quote = findFont(spec.quoteFont);
  const label = findFont(spec.labelFont);

  const fontsUsed = [...new Set([quote, label])].filter((f) => !f.builtIn);
  const fontsUrl = fontsUsed.length
    ? "https://fonts.googleapis.com/css2?" +
      fontsUsed.map((f) => "family=" + f.name.replace(/ /g, "+") + (f.axes ? ":" + f.axes : "")).join("&") +
      "&display=swap"
    : "";

  // One theme per background. Text is black or white, whichever reads better.
  // The accent is used where it shows up; on a background too close to it,
  // the text color stands in so nothing disappears.
  const themes = spec.backgrounds.map((bg) => {
    const text = contrast(bg, "#ffffff") >= contrast(bg, "#1d1d1b") ? "#ffffff" : "#1d1d1b";
    const dark = text === "#ffffff";
    const accentShows = contrast(spec.accent, bg) >= 1.8;
    const accentReads = contrast(spec.accent, bg) >= 3;
    return {
      name: bg.toUpperCase(),
      bg,
      text,
      accent: accentShows ? spec.accent : text,
      label: accentReads ? spec.accent : text,
      divider: dark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.12)",
      logo: dark ? (spec.logoDark || spec.logoLight) : (spec.logoLight || spec.logoDark),
    };
  });

  const hasLogo = spec.logoLight || spec.logoDark;
  const labelFont = {
    family: fontFamily(label),
    weight: label.bold,
    uppercase: spec.labelCaps,
    tracking: spec.labelCaps ? 0.1 : 0,
  };

  return {
    id: spec.id,
    name: spec.name || "Untitled brand",
    custom: true,
    fontsUrl,
    themes,
    allowCustomColor: spec.anyColor,
    quoteFonts: [{
      name: quote.name,
      family: fontFamily(quote),
      style: spec.quoteItalic && quote.italic ? "italic" : "normal",
    }],
    labelFont,
    quoteMark: {
      opacity: spec.quoteMark === "faint" ? 0.3 : 1,
      useTextColor: spec.quoteMark === "faint",
      family: fontFamily(quote),
      weight: quote.bold,
    },
    rule: spec.rule,
    footer: hasLogo || spec.footerName
      ? { logoHeight: spec.logoWide ? 36 : 30, name: spec.footerName, nameFont: { ...labelFont, weight: label.bold, tracking: 0.03 } }
      : null,
  };
}
