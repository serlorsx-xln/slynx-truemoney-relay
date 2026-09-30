# ⚠️ DEPRECATED — NO LONGER WORKING

**This project no longer works** due to upstream API/service changes on TrueMoney's side, and it will not be fixed. It is kept public for reference and educational purposes only. Do not deploy it expecting working voucher verification.

---

# truemoney-relay

A tiny Cloudflare Worker that relays [TrueMoney gift voucher](https://gift.truemoney.com) **verify** and **redeem** API calls from your own server.

**Why it exists:** TrueMoney sits behind Cloudflare and commonly blocks datacenter and hosting-provider IPs with a 403 challenge. If your backend runs on a VPS, Coolify, Railway, Fly.io, or any other server, calling `gift.truemoney.com` directly often fails. This Worker runs on Cloudflare's own edge - the same network TrueMoney trusts - so your server's calls pass through cleanly.

It is a **transparent pass-through proxy**. It never stores voucher codes, never redeems on its own, and holds no state. Your backend keeps full control of the payment flow; the relay only fixes the network path.

```
Your server ──▶ your-relay.workers.dev ──▶ gift.truemoney.com
   (any IP)        (Cloudflare edge)        (trusted origin)
```

## Features

- Forwards `GET /campaign/vouchers/:code/verify` and `POST /campaign/vouchers/:code/redeem` unmodified
- Secret-header auth (`X-Relay-Secret`) so only your backend can use it - it is not an open proxy
- Spoofs the browser headers TrueMoney expects (Origin, Referer, User-Agent)
- Strict `no-store` on every response - voucher responses are never cached at the edge
- Allows only the two voucher paths; everything else is rejected with `400`
- No CORS - server-to-server only
- Single file, zero runtime dependencies, free-tier friendly

## Requirements

- A free [Cloudflare](https://dash.cloudflare.com/sign-up) account
- Node.js 18+ with npm/npx

## Deploy (your own Cloudflare account)

```bash
git clone <this repo>
cd truemoney-relay

# 1. log in to Cloudflare (opens a browser)
npx wrangler login

# 2. deploy the worker
npx wrangler deploy

# 3. set your own relay secret (generate one, e.g.:  openssl rand -hex 24)
npx wrangler secret put RELAY_SECRET
```

After deploying you get your own endpoint:

```
https://truemoney-relay.<your-subdomain>.workers.dev
```

Optional: rename the worker first by editing `name` in [`wrangler.toml`](wrangler.toml) so it is clearly yours.

## Connect your backend

Point your payment code at the relay instead of TrueMoney directly, sending the same secret on every request.

Environment variables for your server / hosting panel:

| Variable | Value |
|---|---|
| `TRUEMONEY_API_BASE` | `https://truemoney-relay.<your-subdomain>.workers.dev/campaign/vouchers` |
| `TRUEMONEY_RELAY_SECRET` | the value you set in step 3 above |
| `TRUEMONEY_PHONE` | your TrueMoney wallet number (the account that receives money) |

Every request your backend makes must carry the header:

```
X-Relay-Secret: <TRUEMONEY_RELAY_SECRET>
```

Requests without the correct header get `401`. Wrong paths get `400`.

### Example

```bash
# verify a voucher (does not consume it)
curl "https://truemoney-relay.<you>.workers.dev/campaign/vouchers/<CODE>/verify?mobile=08XXXXXXXX" \
  -H "X-Relay-Secret: $SECRET"
```

## API

The relay is a path-for-path proxy - whatever TrueMoney normally returns, you get back unchanged:

| Method | Path | Upstream |
|---|---|---|
| `GET` | `/campaign/vouchers/:code/verify?mobile=...` | reads amount without consuming |
| `POST` | `/campaign/vouchers/:code/redeem` | consumes the voucher |

Both expect `Content-Type: application/json` and a TrueMoney-style JSON body on redeem (`{"mobile": "...", "voucher_hash": "..."}`).

## Security notes

- `RELAY_SECRET` gates every request - treat it like a password and never commit it
- The Worker holds **no** state: no logs, no storage, no voucher database
- Only `verify`/`redeem` under `/campaign/vouchers/:code/` are forwarded; nothing else
- Responses are marked `no-store` so no CDN or browser ever caches voucher data
- Keep the Worker server-to-server only; there is deliberately no CORS support

## Self-check after deploy

```bash
# without the secret - expect 401
curl -i https://truemoney-relay.<you>.workers.dev/campaign/vouchers/TEST/verify

# wrong path - expect 400
curl -i -H "X-Relay-Secret: $SECRET" https://truemoney-relay.<you>.workers.dev/other
```

## License

MIT
