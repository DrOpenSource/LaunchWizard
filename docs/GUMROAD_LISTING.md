# 🛍️ LaunchWizard Pro — Gumroad Media Kit & Listing Copy

> Use this exact copy and media assets to configure your Gumroad listing at **https://kashyapster867.gumroad.com/l/launchwizard**.

---

## 🏷️ Basic Product Information

| Field | Content |
| :--- | :--- |
| **Name** | **LaunchWizard Pro Lifetime 🚀** |
| **Subtitle** | Catch build errors before you deploy, fix them in one click, and share private live links from Cursor & VS Code |
| **Price** | **$9.99** (One-Time Lifetime Payment · Pay once, own forever) |
| **Call to Action** | `I want this!` or `Get Pro Lifetime` |
| **Category** | Software Development / Developer Tools |
| **Tags** | `vscode`, `cursor`, `antigravity`, `vibe coding`, `cloudflare tunnel`, `preflight`, `nextjs`, `vite`, `vercel` |
| **Canonical URL** | `https://launchwizard.taqnik.in` |
| **Privacy Policy URL** | `https://launchwizard.taqnik.in/privacy` |
| **Terms / EULA URL** | `https://launchwizard.taqnik.in/eula` |
| **Support Email** | `taqnikin@gmail.com` |

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

## 📝 Product Description (Copy & Paste directly into Gumroad)

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

## 🔑 License Key Generation & Delivery

* **Format**: Gumroad standard license key. The legacy `SHIP-PRO-XXXX-XXXX` format is retired (none were ever issued).
* **Gumroad settings**: enable "Generate a unique license key per sale" on the product.
* **How the extension checks keys** (Gumroad's free license API, no server):
  1. **Activation**: `POST https://api.gumroad.com/v2/licenses/verify` — first read-only (`increment_uses_count=false`) to check seats, then once with `increment_uses_count=true` on a new machine. A 4th machine is refused.
  2. **Weekly re-check**: read-only verify; refunded or charged-back purchases drop to Free.
  3. **Offline**: Pro keeps working for 30 days after the last successful check.
* **Seat resets**: see [`docs/SUPPORT.md`](SUPPORT.md).
