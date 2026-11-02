// BRAND EDITOR — the code for editor.html.
// Holds the list of brands, fills the form from the chosen one, saves on
// every change, and sends the brand to the preview on the right.

const $ = (id) => document.getElementById(id);

let brands = [];        // every saved brand, as the editor stores them
let current = null;     // the brand being edited
let previewTheme = 0;   // which background the preview shows

const SAMPLE_SHORT = "The best ideas are the ones you can explain in a sentence.";
const SAMPLE_LONG = "Most people overestimate what they can do in a week and underestimate what they can do in a year. Small, steady effort compounds. The trick is to keep showing up long after it stops feeling new.";

// Buttons inside a form would reload the page when clicked. Stop that.
$("form").addEventListener("submit", (e) => e.preventDefault());
document.querySelectorAll("form button").forEach((b) => (b.type = "button"));

// ─────────────────────────────────────────────────────────────
// Brand list
// ─────────────────────────────────────────────────────────────
function renderList() {
  const list = $("brandList");
  list.innerHTML = "";
  brands.forEach((b) => {
    const btn = document.createElement("button");
    btn.textContent = b.name || "Untitled brand";
    btn.classList.toggle("selected", current && b.id === current.id);
    btn.addEventListener("click", () => select(b.id));
    list.appendChild(btn);
  });
  $("emptyList").classList.toggle("hidden", brands.length > 0);
}

function select(id) {
  current = brands.find((b) => b.id === id) || null;
  previewTheme = 0;
  $("welcome").classList.toggle("hidden", !!current);
  $("form").classList.toggle("hidden", !current);
  renderList();
  if (current) fillForm();
  sendPreview();
}

$("newBtn").addEventListener("click", async () => {
  const spec = newBrandSpec();
  spec.name = "New brand";
  brands.push(spec);
  await save();
  select(spec.id);
  $("name").select();
});

// ─────────────────────────────────────────────────────────────
// Form: fill it from the brand, and read changes back
// ─────────────────────────────────────────────────────────────
function fontOptions(select) {
  select.innerHTML = "";
  const groups = { serif: "Serif", sans: "Sans serif" };
  const builtIn = document.createElement("optgroup");
  builtIn.label = "Built in (no download)";
  Object.entries(groups).forEach(([kind, label]) => {
    const g = document.createElement("optgroup");
    g.label = label;
    FONT_CHOICES.filter((f) => f.kind === kind && !f.builtIn).forEach((f) => {
      const o = document.createElement("option");
      o.value = o.textContent = f.name;
      g.appendChild(o);
    });
    select.appendChild(g);
  });
  FONT_CHOICES.filter((f) => f.builtIn).forEach((f) => {
    const o = document.createElement("option");
    o.value = o.textContent = f.name;
    builtIn.appendChild(o);
  });
  select.appendChild(builtIn);
}
fontOptions($("quoteFont"));
fontOptions($("labelFont"));

const HEX = /^#[0-9a-f]{6}$/i;

// A color picker plus a box for typing a hex code (brand kits list hex codes).
function colorField(value, onChange, onRemove) {
  const wrap = document.createElement("div");
  wrap.className = "color-field";
  const picker = document.createElement("input");
  picker.type = "color";
  picker.value = value;
  const text = document.createElement("input");
  text.type = "text";
  text.value = value.toUpperCase();
  text.maxLength = 7;
  picker.addEventListener("input", () => {
    text.value = picker.value.toUpperCase();
    onChange(picker.value);
  });
  text.addEventListener("input", () => {
    let v = text.value.trim();
    if (v && !v.startsWith("#")) v = "#" + v;
    if (HEX.test(v)) { picker.value = v; onChange(v); }
  });
  // When you click away, tidy the box (add the #, capitals) or undo a bad entry.
  text.addEventListener("blur", () => { text.value = picker.value.toUpperCase(); });
  wrap.append(picker, text);
  if (onRemove) {
    const x = document.createElement("button");
    x.type = "button";
    x.className = "remove";
    x.title = "Remove this background";
    x.textContent = "×";
    x.addEventListener("click", onRemove);
    wrap.appendChild(x);
  }
  return wrap;
}

function renderBackgrounds() {
  const box = $("backgrounds");
  box.innerHTML = "";
  current.backgrounds.forEach((bg, i) => {
    const canRemove = current.backgrounds.length > 1;
    box.appendChild(colorField(bg,
      (v) => { current.backgrounds[i] = v; changed(); },
      canRemove ? () => { current.backgrounds.splice(i, 1); renderBackgrounds(); changed(); } : null));
  });
  $("addBgBtn").classList.toggle("hidden", current.backgrounds.length >= 6);
}

$("addBgBtn").addEventListener("click", () => {
  current.backgrounds.push("#F2E8D5");
  renderBackgrounds();
  changed();
});

function renderLogo(which) {
  const uri = current[which];
  const thumb = $(which + "Thumb");
  thumb.innerHTML = "";
  if (uri) {
    const img = document.createElement("img");
    img.src = uri;
    img.alt = "";
    thumb.appendChild(img);
  } else {
    thumb.textContent = "None";
  }
  $(which + "Remove").classList.toggle("hidden", !uri);
  $(which + "Btn").textContent = uri ? "Replace" : "Upload";
}

function fillForm() {
  $("name").value = current.name;
  renderBackgrounds();
  $("accentField").innerHTML = "";
  $("accentField").appendChild(colorField(current.accent, (v) => { current.accent = v; changed(); }));
  $("anyColor").checked = current.anyColor;
  $("quoteFont").value = current.quoteFont;
  $("quoteItalic").checked = current.quoteItalic;
  $("labelFont").value = current.labelFont;
  $("labelCaps").checked = current.labelCaps;
  renderLogo("logoLight");
  renderLogo("logoDark");
  $("footerName").value = current.footerName;
  document.querySelectorAll('input[name="quoteMark"]').forEach((r) => (r.checked = r.value === current.quoteMark));
  $("rule").checked = current.rule;
  updateItalicBox();
  $("saved").textContent = "";
}

// Some fonts have no italic. Grey the box out for those.
function updateItalicBox() {
  const f = findFont(current.quoteFont);
  $("quoteItalic").disabled = !f.italic;
  $("quoteItalic").parentElement.style.opacity = f.italic ? 1 : 0.45;
}

// Plain fields: read straight into the brand.
$("name").addEventListener("input", () => { current.name = $("name").value; renderList(); changed(); });
$("footerName").addEventListener("input", () => { current.footerName = $("footerName").value; changed(); });
$("anyColor").addEventListener("change", () => { current.anyColor = $("anyColor").checked; changed(); });
$("quoteFont").addEventListener("change", () => { current.quoteFont = $("quoteFont").value; updateItalicBox(); changed(); });
$("quoteItalic").addEventListener("change", () => { current.quoteItalic = $("quoteItalic").checked; changed(); });
$("labelFont").addEventListener("change", () => { current.labelFont = $("labelFont").value; changed(); });
$("labelCaps").addEventListener("change", () => { current.labelCaps = $("labelCaps").checked; changed(); });
$("rule").addEventListener("change", () => { current.rule = $("rule").checked; changed(); });
document.querySelectorAll('input[name="quoteMark"]').forEach((r) =>
  r.addEventListener("change", () => { current.quoteMark = r.value; changed(); }));

// ─────────────────────────────────────────────────────────────
// Logos. The picture is shrunk to a sensible size and turned into text
// (a data URI) right here in the browser. Nothing is uploaded anywhere.
// ─────────────────────────────────────────────────────────────
["logoLight", "logoDark"].forEach((which) => {
  $(which + "Btn").addEventListener("click", () => $(which + "File").click());
  $(which + "Remove").addEventListener("click", () => {
    current[which] = "";
    renderLogo(which);
    updateLogoShape();
    changed();
  });
  $(which + "File").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";   // so picking the same file again still triggers
    if (!file) return;
    try {
      current[which] = await shrinkLogo(file);
      renderLogo(which);
      updateLogoShape();
      changed();
    } catch (err) {
      showMessage("That file couldn't be read as an image. Try a PNG.");
    }
  });
});

function shrinkLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // SVGs without a set size report 0; give them one.
        const w0 = img.naturalWidth || 600, h0 = img.naturalHeight || 600;
        const scale = Math.min(1, 300 / h0, 1200 / w0);
        const c = document.createElement("canvas");
        c.width = Math.round(w0 * scale);
        c.height = Math.round(h0 * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// A logo much wider than tall (one with the name in it) gets a bit more room.
function updateLogoShape() {
  const uri = current.logoLight || current.logoDark;
  if (!uri) { current.logoWide = false; return; }
  const img = new Image();
  img.onload = () => {
    current.logoWide = img.naturalWidth / img.naturalHeight > 1.6;
    changed();
  };
  img.src = uri;
}

// ─────────────────────────────────────────────────────────────
// Saving. Every change saves after a short pause.
// ─────────────────────────────────────────────────────────────
let saveTimer = null;
function changed() {
  sendPreview();
  $("saved").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await save();
      $("saved").textContent = "Saved. Reopen the card maker to use the changes.";
    } catch (err) {
      $("saved").textContent = "";
      showMessage(err.message || "Couldn't save.");
    }
  }, 350);
}

async function save() {
  await BrandStore.save(brands);
}

function showMessage(text) {
  $("message").textContent = text;
  clearTimeout(showMessage.t);
  showMessage.t = setTimeout(() => ($("message").textContent = ""), 6000);
}

// ─────────────────────────────────────────────────────────────
// Export, import, duplicate, delete
// ─────────────────────────────────────────────────────────────
function slug(text) {
  return (text || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "brand";
}

$("exportBtn").addEventListener("click", () => {
  const file = { format: "quote-cards-brand", version: 1, brand: current };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = slug(current.name) + ".quotecard.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== "quote-cards-brand" || !data.brand) throw new Error();
    const spec = cleanImported(data.brand);
    brands.push(spec);
    await save();
    select(spec.id);
    showMessage("");
  } catch (err) {
    showMessage("That isn't a Quote Cards brand file.");
  }
});

// Only take the fields we know, check the colors, and give it a fresh id
// so importing the same file twice makes two brands rather than a clash.
function cleanImported(raw) {
  const spec = newBrandSpec();
  for (const key of Object.keys(spec)) {
    if (key !== "id" && key in raw && typeof raw[key] === typeof spec[key]) spec[key] = raw[key];
  }
  spec.backgrounds = (Array.isArray(raw.backgrounds) ? raw.backgrounds : []).filter((c) => HEX.test(c)).slice(0, 6);
  if (!spec.backgrounds.length) spec.backgrounds = newBrandSpec().backgrounds;
  if (!HEX.test(spec.accent)) spec.accent = newBrandSpec().accent;
  ["logoLight", "logoDark"].forEach((k) => {
    if (spec[k] && !spec[k].startsWith("data:image/")) spec[k] = "";
  });
  if (!FONT_CHOICES.some((f) => f.name === spec.quoteFont)) spec.quoteFont = newBrandSpec().quoteFont;
  if (!FONT_CHOICES.some((f) => f.name === spec.labelFont)) spec.labelFont = newBrandSpec().labelFont;
  if (!["accent", "faint"].includes(spec.quoteMark)) spec.quoteMark = "accent";
  return spec;
}

$("duplicateBtn").addEventListener("click", async () => {
  const copy = { ...JSON.parse(JSON.stringify(current)), id: newBrandSpec().id, name: current.name + " (copy)" };
  brands.push(copy);
  await save();
  select(copy.id);
});

$("deleteBtn").addEventListener("click", async () => {
  const ok = confirm(`Delete "${current.name || "Untitled brand"}"? This can't be undone. Export it first if you might want it back.`);
  if (!ok) return;
  brands = brands.filter((b) => b.id !== current.id);
  await save();
  select(brands[0] ? brands[0].id : null);
});

// ─────────────────────────────────────────────────────────────
// Live preview: the real card maker, in preview mode, in the frame.
// ─────────────────────────────────────────────────────────────
function sendPreview() {
  const frame = $("preview");
  const spec = current || { ...newBrandSpec(), name: "Example" };
  const bgs = spec.backgrounds;
  if (previewTheme >= bgs.length) previewTheme = 0;

  // Background chips under the preview
  const box = $("previewSwatches");
  box.innerHTML = "";
  bgs.forEach((bg, i) => {
    const s = document.createElement("button");
    s.className = "swatch" + (i === previewTheme ? " selected" : "");
    s.style.background = bg;
    s.title = "Preview on " + bg.toUpperCase();
    s.addEventListener("click", () => { previewTheme = i; sendPreview(); });
    box.appendChild(s);
  });

  if (!frame.contentWindow) return;
  frame.contentWindow.postMessage({
    type: "qc-preview",
    spec,
    themeIndex: previewTheme,
    quote: $("previewLong").checked ? SAMPLE_LONG : SAMPLE_SHORT,
    source: "Jane Smith",
    size: "1080x1080",
  }, location.origin === "null" ? "*" : location.origin);
}

$("preview").addEventListener("load", sendPreview);
$("previewLong").addEventListener("change", sendPreview);

// ─────────────────────────────────────────────────────────────
// Start up
// ─────────────────────────────────────────────────────────────
(async () => {
  brands = await BrandStore.load();
  renderList();
  select(brands[0] ? brands[0].id : null);
})();
