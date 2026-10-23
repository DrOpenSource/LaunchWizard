# 🛍️ LaunchWizard Pro — Gumroad Media Kit & Listing Copy

> Use this exact copy and media assets to configure your Gumroad listing at **https://kashyapster867.gumroad.com/l/launchwizard**.
>
> Sections follow Gumroad's product editor tabs: **Product → Content → Receipt → Share**. Field names, options and character limits were checked against Gumroad's open-source editor ([antiwork/gumroad](https://github.com/antiwork/gumroad)) on 2026-10-23.

## ✅ Setup checklist

- [ ] **Product tab**: name, URL, description, cover, thumbnail, call to action, summary, additional details, price, settings, refund policy ([§1](#1-product-tab))
- [ ] **Receipt tab**: welcome + activation message ([§3](#3-welcome-message-receipt-tab--custom-message))
- [ ] **Share tab**: category and tags ([§5](#5-share-tab-discover))
- [ ] Buy a test copy with a 100% discount code and activate it in VS Code ([§6](#6-test-purchase-before-announcing))

---

## 1. Product tab

| Gumroad field | What to enter | Notes |
| :--- | :--- | :--- |
| **Name** | `LaunchWizard Pro Lifetime 🚀` | Max 255 characters. |
| **URL** | `launchwizard` | Custom permalink → `/l/launchwizard`. The website links here. |
| **Description** | Paste [§2](#2-description-product-tab--description) | Rich text: paste the Markdown preview, not the raw `#` symbols. |
| **Cover** | `assets/gumroad_cover.png` | See [Media assets](#-media-assets-to-upload). |
| **Thumbnail** | `assets/gumroad_thumbnail.png` | Square; shown in Library, Discover and profile. |
| **Product info → Call to action** | `I want this!` | Only three options exist: `I want this!`, `Buy this`, `Pay`. |
| **Product info → Summary** | `Lifetime Pro license for the LaunchWizard extension (VS Code, Cursor, Antigravity). Pay once, use on up to 3 personal machines.` | "Shown below the call to action on your product page." This is the checkout-adjacent summary. |
| **Product info → Additional details** | See the table below | Name/value rows shown on the product page. |
| **Pricing** | `$9.99`, fixed | Leave "Pay what you want" off. |
| **Settings → Limit product sales** | Off | |
| **Settings → Allow customers to choose a quantity** | Off | One license per purchase. |
| **Settings → Publicly show the number of sales** | Off for now | Turn on once there are sales worth showing. |
| **Refund policy** | On, **30 days** | Must match the EULA's "30-Day Refund Guarantee". Fine print in the table below. |

**Additional details** (Product info → Add detail):

| Name | Value |
| :--- | :--- |
| Works with | VS Code 1.90+, Cursor, Antigravity |
| License | Lifetime, up to 3 personal machines |
| Payment | One-time, no subscription |
| Updates | All v1.x updates included |
| Current version | 0.5.0 |
| Requires | Free LaunchWizard extension (install link after purchase) |

**Refund policy fine print:**

```text
Not a fit? Email taqnikin@gmail.com within 30 days of purchase for a full refund, no questions asked. Your Pro license is deactivated automatically when the refund is processed.
```

**Reference**

| Item | Value |
| :--- | :--- |
| Canonical URL | `https://launchwizard.taqnik.in` |
| Privacy Policy URL | `https://launchwizard.taqnik.in/privacy` |
| Terms / EULA URL | `https://launchwizard.taqnik.in/eula` |
| Support email | `taqnikin@gmail.com` |
| Product ID (used by the extension) | `5jmErjhP_JXqeLXQtq5TgA==`. **Do not delete and recreate the product**: a new product gets a new ID, and existing keys would stop activating. |

---

## 🖼️ Media Assets to Upload

1. **Cover Image (16:9)**:
   - File path: [`assets/gumroad_cover.png`](../assets/gumroad_cover.png)
   - Dimensions: 2560 × 1440 (2× of the 1280 × 720 spec; dark glass cards, rocket emblem, scannable QR to the site, $9.99 price card). Source: `assets/gumroad-src/cover.html`
2. **Thumbnail Image (1:1)**:
   - File path: [`assets/gumroad_thumbnail.png`](../assets/gumroad_thumbnail.png)
   - Dimensions: 1200 × 1200 (2× of the 600 × 600 spec; rocket emblem, name and $9.99 Lifetime badge). Source: `assets/gumroad-src/thumbnail.html`
3. **App Icon**:
   - File path: [`assets/icon.png`](../assets/icon.png) (1024 px source; the Marketplace uses `assets/icon-marketplace.png`, 256 px)

---

## 2. Description (Product tab → Description)

```markdown
# Stop Fearing Production Build Errors. Get It Live in 1 Click.

You build fast with AI pair programmers like Cursor, Claude, and Antigravity. But the moment you test on your phone or push to Vercel/Cloudflare, you hit the **Production Build Trap**:
* ❌ Cryptic TypeScript walls of red text (`TS2307`, `TS2322`, `TS7006`)
* ❌ Missing Next.js App Router `'use client'` directives crashing the build
* ❌ Imports that work on your laptop but break on Linux build servers
* ❌ API keys accidentally shipped to the browser
* ❌ Tedious mobile testing requiring ngrok tokens or premature git pushes

**LaunchWizard is your pre-flight safety shield.** The free version checks your project, explains every error in plain English, fixes common traps with a preview and undo, and gives you a free HTTPS link with a phone QR code. **Pro makes it automatic, private and one-click.**

---

### 🌟 What's Included in Pro Lifetime ($9.99 One-Time):

**Ship safe**
* 🪄 **Auto-fix on save**: missing `'use client'`, wrong-case imports and `.env` values cut off at `#` are fixed when you save, with an Undo button.
* 🔐 **Secret Leak Guard**: finds hard-coded Stripe, AWS, OpenAI, Anthropic, GitHub and Supabase keys before you share a link or deploy.
* 🚧 **Pre-Push Gate**: a git hook that stops pushes with build blockers.
* 📦 **Dependency Health & Bundle Budget**: security holes, outdated frameworks and JavaScript size, in plain English.

**Share**
* 🔒 **Private links**: passcode protection, links that close themselves, and a visitor log (device, browser, page).
* 🗂️ **Team preview cards**: link, passcode, branch, commit and build status in one paste for Slack or a PR, plus a QR code image.
* ➕ **Multi-port sharing**: share your frontend and API together.
* 🔗 **Custom subdomains** *(beta)*: `preview.yourdomain.com` on your own Cloudflare domain.

**Ship**
* 🚀 **BYOK 1-click deploy** *(beta)*: Vercel or Cloudflare Pages with your own free account; pre-flight checked first, preview by default.
* 📄 **Shareable reports**: export the pre-flight report as Markdown or HTML.

**Plus:** lifetime updates and up to 3 personal machines per license.

**Free for everyone (no license needed):** pre-flight check, full production build check, plain-English error cards, 1-click fixes with preview and undo, shareable HTTPS links and the in-IDE QR code.

**Good to know:** deploy and custom subdomains are in beta (tested against simulated Vercel/Cloudflare tools). Full list of limitations: https://launchwizard.taqnik.in/#limitations

* 🔒 **Private by design**: checks run on your computer; your code is never uploaded. No analytics, no surveillance.

---

### 🛡️ The Calm Dev Triad:
LaunchWizard works alongside its sibling tools for maximum dev peace-of-mind:
* **GitWizard**: Protects git history and auto-saves against AI overwrites.
* **EnvWizard**: Unjams blocked ports (:3000, :5173) and heals `.env` files.
* **LaunchWizard**: Catches build blockers and gets your app live instantly.

Pay once. Own it forever. Zero monthly fees.
```

---

## 3. Welcome message (Receipt tab → Custom message)

Gumroad generates each buyer's license key and sends it in the receipt on its own. This message only welcomes them and explains activation. It contains no key.

```text
Welcome to LaunchWizard Pro! 🚀 Thanks for your purchase.

To activate:
1. Install LaunchWizard from the Extensions view in VS Code, Cursor or Antigravity (search "LaunchWizard").
2. Press Ctrl+Shift+P (Cmd+Shift+P on Mac) and run "LaunchWizard: Activate Pro License".
3. Paste the license key from your Gumroad receipt and press Enter.
```

The Content tab can stay empty, or hold the same text if you want it on the buyer's Library page too.

---

## 5. Share tab (Discover)

| Gumroad field | What to enter |
| :--- | :--- |
| **Category** | Software Development → Developer Tools (or the closest available) |
| **Tags** | `vscode`, `cursor`, `antigravity`, `vibe coding`, `developer tools`, `nextjs`, `vite`, `vercel`, `cloudflare` |
| **Display your product's 1–5 star rating** | On once there are reviews |
| **Discover fee** | Leave at the default |

Checkout **custom fields**: none. Activation needs nothing extra from the buyer, and fewer fields means fewer abandoned checkouts.

---

## 6. Test purchase before announcing

1. Create a 100% discount code, buy the product yourself, and open the receipt email.
2. Check the receipt shows the license key and the welcome message.
3. Activate it in VS Code. **LaunchWizard: Show License Status** should show "Machines: 1 of 3".
4. Free the test seat (see [`docs/SUPPORT.md`](SUPPORT.md)) and delete the discount code.

---

## 7. License key technical notes

* **Format**: Gumroad standard license key. The legacy `SHIP-PRO-XXXX-XXXX` format is retired (none were ever issued).
* **Gumroad settings**: license keys are generated and emailed by Gumroad for every sale; keep license keys enabled on the product.
* **How the extension checks keys** (Gumroad's free license API, no server):
  1. **Activation**: `POST https://api.gumroad.com/v2/licenses/verify` — first read-only (`increment_uses_count=false`) to check seats, then once with `increment_uses_count=true` on a new machine. A 4th machine is refused.
  2. **Weekly re-check**: read-only verify; refunded or charged-back purchases drop to Free.
  3. **Offline**: Pro keeps working for 30 days after the last successful check.
* **Seat resets**: see [`docs/SUPPORT.md`](SUPPORT.md).
