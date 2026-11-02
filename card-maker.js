// QUOTE CARD MAKER — the drawing code for card-maker.html.
// (It lives in its own file because Chrome extensions don't run code written inside an HTML page.)

// ─────────────────────────────────────────────────────────────
// Grab the page elements we need to read from or write to.
// ─────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const canvas = $("card");
const ctx = canvas.getContext("2d"); // the "paintbrush" for the canvas

let brand = null;           // the brand currently chosen (set once brands load)
let theme = null;           // the background theme currently chosen

// ─────────────────────────────────────────────────────────────
// Remember choices between visits.
// (Wrapped in try/catch because some browsers block storage.)
// ─────────────────────────────────────────────────────────────
// The brand editor shows this page inside itself as a live preview
// (card-maker.html?embed=1). A preview shouldn't change your saved choices.
const EMBED = new URLSearchParams(location.search).has("embed");

function remember(key, value) {
  if (EMBED) return;
  try { localStorage.setItem("qc-" + key, value); } catch (e) {}
}
function recall(key) {
  try { return localStorage.getItem("qc-" + key); } catch (e) { return null; }
}

// ─────────────────────────────────────────────────────────────
// Colors. A theme in a brand file can leave out text/accent/label/divider;
// these fill in sensible defaults so a new brand needs only a background.
// ─────────────────────────────────────────────────────────────
function autoTextColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#1d1d1b" : "#ffffff";
}

function fillTheme(t) {
  const text = t.text || autoTextColor(t.bg);
  return {
    ...t,
    text,
    accent: t.accent || text,
    label: t.label || text,
    divider: t.divider || (text === "#ffffff" ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"),
  };
}

// ─────────────────────────────────────────────────────────────
// Fonts. Web fonts have to finish loading before the canvas can use them,
// otherwise the first draw comes out in the fallback font.
// ─────────────────────────────────────────────────────────────
// Keyed by the fonts link, so editing a brand's fonts loads the new ones.
const fontsReady = {};
function loadBrandFonts(b) {
  if (!b.fontsUrl) return Promise.resolve();
  if (fontsReady[b.fontsUrl]) return fontsReady[b.fontsUrl];
  fontsReady[b.fontsUrl] = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = b.fontsUrl;
    link.onload = resolve;
    link.onerror = resolve;   // offline: carry on with fallback fonts
    document.head.appendChild(link);
  }).then(() => {
    const specs = [];
    b.quoteFonts.forEach((f) => specs.push(fontSpec(f, 40)));
    specs.push(fontSpec(b.labelFont, 40));
    if (b.quoteMark && b.quoteMark.family) specs.push(fontSpec(b.quoteMark, 40));
    if (b.footer && b.footer.nameFont) specs.push(fontSpec(b.footer.nameFont, 40));
    return Promise.all(specs.map((s) => document.fonts.load(s).catch(() => {})));
  });
  return fontsReady[b.fontsUrl];
}

// Turn a font description from a brand file into the string canvas expects,
// e.g. "italic 400 48px Georgia, serif".
function fontSpec(f, size) {
  return `${f.style || "normal"} ${f.weight || 400} ${size}px ${f.family}`;
}

// ─────────────────────────────────────────────────────────────
// Logos. Brand files hold them as text (data URIs). We turn each one into
// an image once, and redraw when it has finished loading.
// ─────────────────────────────────────────────────────────────
const logoCache = {};
function logoImage(dataUri) {
  if (!dataUri) return null;
  if (!logoCache[dataUri]) {
    const img = new Image();
    img.onload = draw;
    img.src = dataUri;
    logoCache[dataUri] = img;
  }
  const img = logoCache[dataUri];
  return img.complete && img.naturalWidth ? img : null;
}

// ─────────────────────────────────────────────────────────────
// Build the controls for whichever brand is chosen.
// ─────────────────────────────────────────────────────────────
function fillBrandDropdown() {
  $("brand").innerHTML = "";
  BRANDS.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.name;
    $("brand").appendChild(opt);
  });
}

function setBrand(id) {
  brand = BRANDS.find((b) => b.id === id) || BRANDS[0];
  $("brand").value = brand.id;
  remember("brand", brand.id);

  // Background swatches
  const box = $("swatches");
  box.innerHTML = "";
  brand.themes.forEach((t, i) => {
    const btn = document.createElement("button");
    btn.className = "swatch";
    btn.style.background = t.bg;
    btn.title = t.name;
    btn.dataset.index = i;
    btn.addEventListener("click", () => setTheme(i));
    box.appendChild(btn);
  });
  if (brand.allowCustomColor) {
    const picker = document.createElement("input");
    picker.type = "color";
    picker.id = "customColor";
    picker.title = "Pick any color";
    picker.addEventListener("input", (e) => setTheme("custom", e.target.value));
    box.appendChild(picker);
  }

  // Font choices (hidden when the brand only has one)
  $("font").innerHTML = "";
  brand.quoteFonts.forEach((f, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = f.name;
    $("font").appendChild(opt);
  });
  $("font").value = recall("font-" + brand.id) || 0;
  $("fontBox").classList.toggle("hidden", brand.quoteFonts.length < 2);

  // Brand extras: only show the switches a brand actually has
  $("chevronBox").classList.toggle("hidden", !brand.chevron);
  $("footerBox").classList.toggle("hidden", !brand.footer);
  $("cornerBox").classList.toggle("hidden", !!brand.footer);

  // Restore this brand's last background
  const saved = recall("theme-" + brand.id);
  if (saved && saved.startsWith("#") && brand.allowCustomColor) setTheme("custom", saved);
  else setTheme(Number(saved) < brand.themes.length ? Number(saved) || 0 : 0);

  loadBrandFonts(brand).then(draw);
}

function setTheme(index, customColor) {
  if (index === "custom") {
    theme = fillTheme({ name: "Custom", bg: customColor });
    remember("theme-" + brand.id, customColor);
  } else {
    theme = fillTheme(brand.themes[index]);
    remember("theme-" + brand.id, index);
  }
  document.querySelectorAll(".swatch").forEach((s) => {
    s.classList.toggle("selected", Number(s.dataset.index) === index);
  });
  if ($("customColor")) $("customColor").value = theme.bg;
  draw();
}

// ─────────────────────────────────────────────────────────────
// Canvas has no word wrap, so we do it ourselves: add words to a line
// until the next word would make it too wide, then start a new line.
// Line breaks you type in the quote box are kept.
// ─────────────────────────────────────────────────────────────
function wrapText(text, maxWidth) {
  const lines = [];
  text.split("\n").forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines.push(""); return; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + " " + words[i];
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
  });
  return lines;
}

// Set a font on the canvas, including uppercase-style letter spacing.
function useFont(f, size) {
  ctx.font = fontSpec(f, size);
  ctx.letterSpacing = f.tracking ? `${f.tracking * size}px` : "0px";
}

// The » chevron motif: two strokes with a gradient, drawn as shapes so
// it stays sharp at any size. Same geometry as the brand's chevron.svg.
function drawChevron(x, y, width, colors) {
  const k = width / 120;  // the original drawing is 120 wide
  const grad = ctx.createLinearGradient(x, y, x + 120 * k, y + 80 * k);
  grad.addColorStop(0, colors.from);
  grad.addColorStop(1, colors.to);
  ctx.save();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 16 * k;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  [0, 48].forEach((dx) => {
    ctx.beginPath();
    ctx.moveTo(x + (8 + dx) * k, y + 8 * k);
    ctx.lineTo(x + (44 + dx) * k, y + 40 * k);
    ctx.lineTo(x + (8 + dx) * k, y + 72 * k);
    ctx.stroke();
  });
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────
// THE MAIN FUNCTION: paint the whole card.
// Runs every time you change anything.
// ─────────────────────────────────────────────────────────────
function draw() {
  if (!theme) return;

  // 1. Size the canvas to the chosen preset.
  const [W, H] = $("size").value.split("x").map(Number);
  canvas.width = W;
  canvas.height = H;

  // Everything is measured in "u": 1/460th of the card's short side.
  // (460 is the card size the brand's own quote template was drawn at,
  // so its spacing carries straight over.)
  const u = Math.min(W, H) / 460;
  const pad = 44 * u;

  const quote = $("quote").value.trim() || "Paste a quote…";
  const source = $("source").value.trim();
  const corner = $("corner").value.trim();
  const quoteFont = brand.quoteFonts[$("font").value] || brand.quoteFonts[0];
  const showMark = $("showMark").checked;
  const showChevron = brand.chevron && $("showChevron").checked;
  const showFooter = brand.footer && $("showFooter").checked;

  // 2. Background.
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, W, H);

  // 3. Footer first, so we know how much room is left for the quote.
  let bottomLimit = H - pad;
  if (showFooter) {
    // A square logomark, or a wide logo with the name built in.
    // logoHeight is in u; the width follows the logo's own shape.
    const logoSize = (brand.footer.logoHeight || 30) * u;
    const rowY = H - 30 * u - logoSize / 2;   // vertical middle of the footer row
    const lineY = H - 30 * u - logoSize - 16 * u;
    ctx.fillStyle = theme.divider;
    ctx.fillRect(pad, lineY, W - pad * 2, Math.max(1, u));

    let x = pad;
    const logo = logoImage(theme.logo);
    if (logo) {
      const logoWidth = logoSize * logo.naturalWidth / logo.naturalHeight;
      ctx.drawImage(logo, x, rowY - logoSize / 2, logoWidth, logoSize);
      x += logoWidth + 10 * u;
    }
    ctx.textBaseline = "middle";
    if (brand.footer.name) {
      ctx.fillStyle = theme.text;
      useFont(brand.footer.nameFont, 13 * u);
      const name = brand.footer.nameFont.uppercase ? brand.footer.name.toUpperCase() : brand.footer.name;
      ctx.fillText(name, x, rowY);
    }
    if (brand.footer.signoff) {
      ctx.fillStyle = theme.accent;
      useFont(brand.footer.nameFont, 11 * u);
      ctx.textAlign = "right";
      ctx.fillText(brand.footer.signoff, W - pad, rowY);
      ctx.textAlign = "left";
    }
    bottomLimit = lineY - 20 * u;
  } else if (corner) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = theme.text;
    useFont(brand.labelFont, 12 * u);
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(corner, W - pad, H - pad);
    ctx.restore();
    bottomLimit = H - pad - 30 * u;
  }

  // 4. Chevrons in the corners, and keep the quote clear of them.
  let topLimit = pad;
  if (showChevron) {
    const cw = 70 * u, ch = cw * 80 / 120;
    drawChevron(30 * u, 26 * u, cw, brand.chevron);
    drawChevron(W - 30 * u - cw, bottomLimit - ch, cw, brand.chevron);
    topLimit = 26 * u + ch + 24 * u;
    bottomLimit -= ch + 6 * u;
  }

  // 5. Measure the attribution block (rule + name) so the quote can fit around it.
  const labelSize = 13 * u;
  const attribHeight = source ? 22 * u + (brand.rule ? 3 * u + 12 * u : 0) + labelSize : 0;

  // 6. Start with big text and shrink it until mark + quote + attribution fit.
  const boxWidth = W - pad * 2;
  const available = bottomLimit - topLimit;
  let fontSize = 46 * u;
  const minSize = 13 * u;
  let lines, lineHeight, markHeight, total;
  while (true) {
    useFont(quoteFont, fontSize);
    lines = wrapText(quote, boxWidth);
    lineHeight = fontSize * 1.3;
    markHeight = showMark ? fontSize * 1.3 : 0;
    total = markHeight + lines.length * lineHeight + attribHeight;
    if (total <= available || fontSize <= minSize) break;
    fontSize -= 0.5 * u;
  }

  // If it still doesn't fit at the smallest readable size, say so.
  // (The card is drawn anyway, starting from the top, so you can see where it runs over.)
  const tooLong = total > available;
  showTooLongWarning(tooLong, W, H);

  // 7. Draw the block, centred vertically in the space left.
  let y = topLimit + Math.max(0, (available - total) / 2);
  ctx.textBaseline = "top";

  if (showMark) {
    const m = brand.quoteMark || {};
    ctx.save();
    ctx.globalAlpha = m.opacity ?? 1;
    ctx.fillStyle = m.useTextColor ? theme.text : theme.accent;
    useFont({ family: m.family || quoteFont.family, weight: m.weight || 700 }, fontSize * 2.8);
    ctx.fillText("“", pad - fontSize * 0.1, y - fontSize * 0.35);
    ctx.restore();
    y += markHeight;
  }

  ctx.fillStyle = theme.text;
  useFont(quoteFont, fontSize);
  lines.forEach((line) => {
    ctx.fillText(line, pad, y);
    y += lineHeight;
  });

  if (source) {
    y += 22 * u - (lineHeight - fontSize);  // gap below the last line of text
    if (brand.rule) {
      ctx.fillStyle = theme.accent;
      ctx.fillRect(pad, y, 40 * u, 3 * u);
      y += 3 * u + 12 * u;
    }
    ctx.fillStyle = theme.label;
    useFont(brand.labelFont, labelSize);
    const text = brand.labelFont.uppercase ? source.toUpperCase() : "— " + source;
    ctx.fillText(text, pad, y);
  }
  ctx.letterSpacing = "0px";
}

// ─────────────────────────────────────────────────────────────
// Save and copy.
// ─────────────────────────────────────────────────────────────
// The too-long warning stays up until the quote fits, unlike status
// messages, which clear themselves after a few seconds.
function showTooLongWarning(tooLong, W, H) {
  const box = $("warning");
  if (!tooLong) { box.textContent = ""; return; }
  const tallest = H >= 1920;
  const square = W === H;
  let tip = "Trim the quote.";
  if (!tallest) tip = square || W > H
    ? "Try Portrait or Story, or trim the quote."
    : "Try Story, or trim the quote.";
  box.textContent = "Too long for this size. " + tip;
}

function status(msg) {
  $("status").textContent = msg;
  clearTimeout(status.t);
  status.t = setTimeout(() => ($("status").textContent = ""), 3000);
}

function cardBlob() {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

$("downloadBtn").addEventListener("click", async () => {
  const blob = await cardBlob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  const slug = $("quote").value.trim().split(/\s+/).slice(0, 5).join("-")
    .toLowerCase().replace(/[^a-z0-9-]/g, "");
  link.download = `${brand.id}-${slug || "card"}.png`;
  link.click();
  URL.revokeObjectURL(link.href);
  status("Downloaded.");
});

$("copyBtn").addEventListener("click", async () => {
  try {
    const blob = await cardBlob();
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    status("Copied. Paste it into your post with Ctrl+V.");
  } catch (err) {
    status("Copy didn't work here. Use Download instead.");
    console.error(err);
  }
});

// The clipboard holds one thing at a time, so the link is its own button:
// paste the card into your post, then come back, copy the link, paste that.
$("copyLinkBtn").addEventListener("click", async () => {
  const link = $("link").value.trim();
  if (!link) { status("No link to copy."); return; }
  try {
    await navigator.clipboard.writeText(link);
    status("Link copied. Paste it into your post with Ctrl+V.");
  } catch (err) {
    $("link").select();
    status("Copy didn't work here. The link is selected; press Ctrl+C.");
    console.error(err);
  }
});

// ─────────────────────────────────────────────────────────────
// Wire everything up.
// ─────────────────────────────────────────────────────────────
$("brand").addEventListener("change", (e) => setBrand(e.target.value));
$("font").addEventListener("change", () => remember("font-" + brand.id, $("font").value));

["size", "corner"].forEach((id) => {
  const saved = recall(id);
  if (saved !== null) $(id).value = saved;
  $(id).addEventListener("change", () => remember(id, $(id).value));
});

["quote", "source", "corner", "size", "font", "showMark", "showChevron", "showFooter"].forEach((id) => {
  $(id).addEventListener("input", draw);
  $(id).addEventListener("change", draw);
});

// The extension opens this page with the highlighted text and page details
// in the address, like card-maker.html?text=...&source=...&brand=b-abc123&url=...
const params = new URLSearchParams(location.search);
if (params.get("text")) $("quote").value = params.get("text");
if (params.get("source")) $("source").value = params.get("source");
if (params.get("url")) $("link").value = params.get("url");

// Private brands in brands/local/ (left out of Git). Each file is added as a
// <script>; a missing folder just means there are none.
function loadScript(src) {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}
async function loadLocalBrands() {
  if (!(await loadScript("brands/local/index.js")) || typeof LOCAL_BRAND_FILES === "undefined") return;
  for (const file of LOCAL_BRAND_FILES) await loadScript("brands/local/" + file);
}

// Start up: load the private brands and the brands made in the brand editor,
// list them in that order with Plain last, then open the right one.
(async () => {
  await loadLocalBrands();
  const specs = await BrandStore.load();
  const plainAt = BRANDS.findIndex((b) => b.id === "plain");
  const plain = plainAt >= 0 ? BRANDS.splice(plainAt, 1) : [];
  BRANDS.push(...specs.map(compileBrand), ...plain);
  fillBrandDropdown();
  // In preview mode the editor may already have sent its brand; keep it.
  if (EMBED && brand && brand.id === "__preview") return;
  setBrand(params.get("brand") || recall("brand") || BRANDS[0].id);
})();

// Preview mode: the editor sends the brand being edited on every change.
if (EMBED) {
  document.body.classList.add("embed");
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin || !event.data || event.data.type !== "qc-preview") return;
    const preview = compileBrand(event.data.spec);
    preview.id = "__preview";
    const i = BRANDS.findIndex((b) => b.id === "__preview");
    if (i >= 0) BRANDS.splice(i, 1);
    BRANDS.push(preview);
    if (event.data.quote) $("quote").value = event.data.quote;
    if (event.data.source !== undefined) $("source").value = event.data.source;
    if (event.data.size) $("size").value = event.data.size;
    setBrand("__preview");
    setTheme(Math.min(event.data.themeIndex || 0, preview.themes.length - 1));
  });
}
