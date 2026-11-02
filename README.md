# Quote Cards

Highlight text on any web page, right-click, and turn it into a quote card in your own brand: your colors, fonts and logo. Copy the card straight into a LinkedIn post, a Substack Note or anywhere else, along with a clean link back to the source.

Everything runs in your browser. Nothing you quote, and none of your brand files, is sent anywhere.

## Install (about 2 minutes)

1. On this project's GitHub page, click the green **Code** button, then **Download ZIP**.
2. Unzip it somewhere you'll keep it, like your Documents folder. The folder is called `quote-cards-main`. Chrome reads the extension from this folder, so don't delete or move it afterward.
3. In Chrome, go to `chrome://extensions`.
4. Turn on **Developer mode** (the switch in the top right).
5. Click **Load unpacked** and choose the `quote-cards-main` folder. If there's another `quote-cards-main` folder inside it, choose that inner one. The right folder has `manifest.json` in it.
6. Optional: click the puzzle-piece icon in Chrome's toolbar and pin **Quote Cards**.

The brand editor opens by itself the first time.

## Add your brand

In the brand editor, click **+ New brand** and fill in:

- **Name**: shows in your menus.
- **Card backgrounds**: one for each background color you want to offer, up to six. Type the hex codes from your brand kit (like `#1B2255`), or use the color picker.
- **Accent color**: used for the quote mark, the short line and the attribution. If your accent is too pale to read on a light background, the card uses dark text there automatically.
- **Fonts**: one for the quote, one for the attribution. All free Google Fonts.
- **Logo** (optional): a PNG with a transparent background works best. If your logo has a white or light version for dark backgrounds, upload that too.
- **Text next to the logo** (optional): leave blank if your logo already shows your name.

It saves as you go, and the card on the right shows what you'll get. Click the colored dots under it to preview each background.

To open the brand editor later: the **Add or edit brands** link at the top of the card maker, or right-click the toolbar icon → **Options**.

## Make a card

1. Highlight text on any page.
2. Right-click → **Make quote card** → pick your brand.
3. The card maker opens with the quote, the attribution and the source link filled in. Check the attribution, since it's a best guess from the page.
4. Pick a background and a size (square, portrait, LinkedIn landscape or story).
5. Click **Copy image** and paste the card into your post. Then click **Copy link** and paste the source link into the post too.

If a quote is too long for the size, an orange note above the Copy button says what to try.

Clicking the toolbar icon opens a blank card maker, for typing a quote in yourself.

## Share a brand with someone

In the brand editor, open the brand and click **Export brand file**. That saves a small `.quotecard.json` file with the colors, fonts and logo. Send it to them. They click **Import brand file** in their brand editor, and it's theirs to use or change.

Exporting is also a good backup. Brands live in your Chrome on this computer only. Removing the extension deletes them.

## Updating to a new version

1. Download the ZIP again (step 1 above) and unzip it.
2. Copy the new files into your existing Quote Cards folder, replacing the old ones. Keep using the same folder.
3. Go to `chrome://extensions` and click the circular reload arrow on Quote Cards.

Your brands are kept.

## What it can see

What it asks Chrome for:
- **The current page, only when you click Make quote card**: when you choose Make quote card, it reads that one page's highlighted text, plus the site name, author and link the page publishes about itself. Only that page, only then.
- **Modify data you copy and paste**: so Copy image and Copy link work.
- **Context menus** and **storage**: the right-click menu, and saving your brands in Chrome.

The source link has tracking codes removed before you see it (email tracking, ad campaign codes, Substack referral and login tokens), so what you share is the plain article address.

## Good to know

- Fonts come from Google Fonts, so you need to be online for them. Offline, cards fall back to Georgia or Arial.
- Chrome sometimes shows a "Disable developer mode extensions" notice for extensions loaded this way. Click the X; it's routine for anything not installed from the Chrome Web Store.
- The **Plain** brand is always there, with any background color.

---

## For whoever maintains this

```
manifest.json      extension ID card: name, icon, permissions, brand editor as the options page
background.js      right-click menu (built from saved brands), page reading, link cleanup
card-maker.html    the card maker page
card-maker.js      draws the card on a canvas
editor.html/.js    the brand editor
brand-store.js     font list, saving/loading brands, compileBrand() (editor choices -> full brand)
brands/plain.js    the built-in Plain brand
brands/registry.js lets built-in brand files register themselves; loads first
brands/local/      private brands in code (optional, never committed)
icons/             toolbar icons
```

- **Brands made in the editor** are stored in `chrome.storage.local` under `brands`, as the simple form the editor shows (`newBrandSpec()` in `brand-store.js`). `compileBrand()` turns that into the full brand the card maker draws with: one theme per background, black or white text by contrast, the accent swapped for text where it wouldn't read, and the Google Fonts link.
- **The preview** in the editor is the real card maker in an iframe (`card-maker.html?embed=1`). The editor posts the brand being edited to it on every change.
- **Adding a font**: add a row to `FONT_CHOICES` in `brand-store.js`. The `axes` value must match what Google Fonts offers for that font exactly (italics and weights). If a font has no italic and the request asks for one, Google refuses the whole font request.
- **Brands in code** can do things the editor can't, like custom artwork. Put them in `brands/local/`, which Git ignores, so they stay private: each file calls `registerBrand()`, and `brands/local/index.js` lists them with `const LOCAL_BRAND_FILES = ["my-logo.js", "my-brand.js"];`. The card maker and the right-click menu load that list when the folder exists, ahead of the editor brands. Without the folder, nothing changes.
- **Logos** are kept as data URIs (text), never as files. Chrome won't let a canvas that drew an image from a local file be saved as a PNG; a data URI doesn't trip that rule. The editor shrinks uploads to at most 300px tall before storing them.
- **Chrome extensions don't allow code inside HTML pages**, including `onclick="…"` attributes. All code lives in the `.js` files.
