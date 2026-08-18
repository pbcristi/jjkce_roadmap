# JJKCE Community Suggestions — One-Time Setup

The public repository contains the complete frontend and Cloudflare Worker/D1 source for anonymous community suggestions. No private JJKCE repository access is required by the suggestion service.

## Architecture

- GitHub Pages: public roadmap and anonymous submission UI.
- Cloudflare Worker: public API, moderation API, validation, rate limiting, and abuse checks.
- Cloudflare D1: durable suggestion storage.
- Cloudflare Turnstile: anonymous bot protection.
- Owner moderation: one strong `ADMIN_TOKEN` stored only as an encrypted Worker secret. The moderation page keeps the token only in browser `sessionStorage` for the current session.

No player account, email address, IP address, browser fingerprint, or private repository credential is stored by this implementation. Rate limiting uses a random browser-local anonymous ID that is salted and hashed by the Worker before it is stored temporarily.

## 1. Create the Cloudflare resources

1. Sign in to Cloudflare.
2. Create a D1 database named `jjkce-community`.
3. Copy its database ID.
4. Create a Turnstile widget for hostname `pbcristi.github.io`.
5. Copy the Turnstile **site key** and **secret key**.

## 2. Configure the Worker source

Edit `worker/wrangler.jsonc` and replace:

`REPLACE_WITH_D1_DATABASE_ID`

with the D1 database ID from step 1.

The committed non-secret configuration intentionally allows only the GitHub Pages origin and expects the Turnstile hostname `pbcristi.github.io`.

## 3. Set Worker secrets

Create three strong secrets. Do not commit them to GitHub.

- `ADMIN_TOKEN` — at least 48 random characters; only the project owner should know it.
- `TURNSTILE_SECRET_KEY` — the Turnstile secret key from Cloudflare.
- `RATE_LIMIT_SALT` — at least 32 random characters, independent of the admin token.

With Wrangler from the `worker` directory:

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put RATE_LIMIT_SALT
```

The same secrets can also be added in Cloudflare Dashboard → Workers & Pages → your Worker → Settings → Variables and Secrets, using **Secret** rather than plaintext variable.

## 4. Apply the D1 migration

From the `worker` directory:

```bash
npx wrangler d1 migrations apply jjkce-community --remote
```

This creates:

- `community_suggestions` — durable public suggestions and moderation state.
- `community_rate_limits` — temporary salted anonymous rate-limit records.

## 5. Deploy the Worker

From the `worker` directory:

```bash
npx wrangler deploy
```

Copy the resulting HTTPS Worker URL, for example:

`https://jjkce-community.<your-workers-subdomain>.workers.dev`

Test:

`<worker-url>/health`

It should return `{"ok":true}`.

## 6. Connect the public roadmap

Edit `community-config.js` in this public repository:

```js
window.JJKCECommunityConfig = Object.freeze({
  apiBaseUrl: "https://jjkce-community.<your-workers-subdomain>.workers.dev",
  turnstileSiteKey: "<YOUR_PUBLIC_TURNSTILE_SITE_KEY>"
});
```

These two values are public identifiers and are safe to commit. Never put the Turnstile secret or admin token in this file.

After GitHub Pages redeploys, the submission form becomes active automatically.

## 7. Verify anonymous submission

1. Open the public roadmap in a private/incognito browser session.
2. Submit a suggestion without signing in or providing identity information.
3. Refresh the page and confirm the suggestion remains visible.
4. Confirm a repeated identical suggestion is rejected.
5. Confirm more than three successful submissions within ten minutes from the same anonymous browser ID are rate-limited.
6. Confirm suggestions over 1000 characters and obvious repeated-character spam are rejected.

## 8. Verify owner moderation

Open:

`https://pbcristi.github.io/jjkce_roadmap/admin.html`

Enter the `ADMIN_TOKEN`. You should be able to:

- move a suggestion through Submitted, Under Review, Approved, Planned / Added to Roadmap, Already Planned, Rejected, Duplicate, and Implemented / Completed;
- add an official developer response;
- permanently delete spam, accidents, or unwanted duplicates.

Anonymous visitors cannot perform these operations because the Worker requires the encrypted admin-token value for every moderation API request.

Suggestions marked Implemented / Completed move to the public completed archive rather than disappearing.

## Security notes

- The private `pbcristi/mod_jjk_ce` repository is never accessed by the Worker or public browser code.
- `ADMIN_TOKEN`, `TURNSTILE_SECRET_KEY`, and `RATE_LIMIT_SALT` belong only in Cloudflare Worker secrets.
- Turnstile validation occurs server-side for every submission.
- The Turnstile secret is never sent to a browser.
- The API accepts browser requests only from the configured GitHub Pages origin.
- User suggestion text is rendered with DOM `textContent`, not inserted as HTML.
- The moderation token is stored only in `sessionStorage`, so closing the tab/session removes the browser copy.
- The Worker intentionally does not log or store player IP addresses.

## Optional future hardening

If community traffic becomes large enough to justify it, the owner can later replace the single admin token with Cloudflare Access or another identity provider without changing the public suggestion data model.
