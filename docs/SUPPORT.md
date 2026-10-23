# 🧰 LaunchWizard — Support Runbook (Maintainer)

Licensing uses Gumroad's free license API only; there is no LaunchWizard server (decision D3, [ADR-005](memory/decisions/ADR-005-gumroad-only-licensing.md)). That keeps running costs at $0, but a few tasks are manual.

---

## 1. Freeing a machine seat

**When:** a buyer replaced a laptop, or hit "This key is already active on 3 machines".

**Request arrives:** by email (the extension's "Request a Seat Reset" button opens a pre-filled email to the support address). Never ask buyers to post their key publicly.

**Steps:**

1. Find the sale in the Gumroad dashboard by the buyer's email and copy the license key.
2. Create a Gumroad API access token once (Settings → Advanced → Applications), with the `edit_products` scope. Keep it private; it never goes into the extension.
3. Lower the seat count by one:

   ```bash
   curl -X PUT https://api.gumroad.com/v2/licenses/decrement_uses_count \
     -d access_token=YOUR_TOKEN \
     -d product_id=5jmErjhP_JXqeLXQtq5TgA== \
     -d license_key=THE_BUYERS_KEY
   ```

   The response includes the new `uses` count. It never goes below 0.
4. Ask the buyer to run **LaunchWizard: Remove License From This Machine** on the old machine (if they still have it) and **Activate Pro License** on the new one.

---

## 2. Refunds and chargebacks

Nothing to do in the extension. The weekly background re-check sees `purchase.refunded` / `purchase.chargebacked` and drops that key to the free tier.

---

## 3. "Pro stopped working"

- **Offline for more than 30 days:** Pro pauses until the next successful check. Connect to the internet and run **LaunchWizard: Show License Status → Re-check Now**.
- **"Gumroad does not recognise this key":** check the buyer copied the whole key from the receipt, and that "Generate a unique license key per sale" is still enabled on the product.

---

## 4. Collecting diagnostics

Ask the user to run **LaunchWizard: Show Log** and paste the relevant part. The log never contains license keys or deploy tokens.
