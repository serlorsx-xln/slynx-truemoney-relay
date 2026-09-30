# Deploy Guide - Step by Step

Set up your own TrueMoney relay on Cloudflare in about 5 minutes. No coding needed - just copy and paste the commands below.

## What you need

1. A free Cloudflare account - sign up at <https://dash.cloudflare.com/sign-up>
2. Node.js 18 or newer installed - download at <https://nodejs.org> (pick the LTS version)

Check Node is installed:

```bash
node -v
```

You should see something like `v20.x.x`.

## Step 1 - Get the code

```bash
git clone <THIS_REPO_URL>
cd truemoney-relay
```

(No git? Click the green **Code** button on the repo page, choose **Download ZIP**, unzip it, then open a terminal inside that folder.)

## Step 2 - Create your relay secret

This is a private password that only YOUR server will use. Generate one:

```bash
openssl rand -hex 24
```

Copy the output (a long hex string) somewhere safe. You will need it twice:
- once now, for the Worker
- once later, in your server's environment variables

## Step 3 - Log in to Cloudflare

```bash
npx wrangler login
```

A browser window opens. Approve the request. The terminal should say you are logged in.

## Step 4 - Set the secret on the Worker

```bash
npx wrangler secret put RELAY_SECRET
```

When it prompts you, paste the secret from step 2 and press Enter.

## Step 5 - Deploy

```bash
npx wrangler deploy
```

When it finishes, it prints your endpoint, something like:

```
https://truemoney-relay.yourname.workers.dev
```

Write this URL down.

## Step 6 - Test it

Without the secret, you should get a 401 (this proves the lock works):

```bash
curl -i https://truemoney-relay.yourname.workers.dev/campaign/vouchers/TEST/verify
```

With your secret, you should get a real TrueMoney JSON response:

```bash
curl -i -H "X-Relay-Secret: YOUR_SECRET_HERE" \
  "https://truemoney-relay.yourname.workers.dev/campaign/vouchers/TESTCODE/verify?mobile=08XXXXXXXX"
```

## Step 7 - Point your server at it

Set these environment variables wherever your backend runs (Coolify, VPS, etc.):

| Variable | Value |
|---|---|
| `TRUEMONEY_API_BASE` | `https://truemoney-relay.yourname.workers.dev/campaign/vouchers` |
| `TRUEMONEY_RELAY_SECRET` | your secret from step 2 |
| `TRUEMONEY_PHONE` | your TrueMoney wallet number |

Restart your backend after changing them.

## Troubleshooting

| Problem | Fix |
|---|---|
| `wrangler: command not found` | Run commands with `npx wrangler ...` exactly as written |
| `401` on every call | The `X-Relay-Secret` header does not match `RELAY_SECRET` - recheck both |
| `503 MISCONFIGURED` | You skipped step 4 - run `npx wrangler secret put RELAY_SECRET` |
| `400 only /campaign/vouchers/...` | Your URL path is wrong - keep `/campaign/vouchers` at the end of `TRUEMONEY_API_BASE` |
| TrueMoney returns an error JSON | The relay is working; the voucher code or phone is the problem |
| Deploy says "not authenticated" | Run `npx wrangler login` again |

## Updating

When a new version of this repo is published:

```bash
git pull
npx wrangler deploy
```

## Cost

Free. Cloudflare's free tier allows 100,000 requests per day - far more than a typical store needs.
