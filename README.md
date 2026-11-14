# Little Bazaar

A simple reselling storefront with a customer catalog, cash-on-delivery checkout, and a private seller area for products and orders.

## Development commands

- `pnpm dev` starts the local development server on `PORT` (default `3000`).
- `pnpm check` runs TypeScript checks.
- `pnpm test` runs the automated tests.
- `pnpm build:static` builds the Vite storefront for Vercel into `dist/public`.
- `pnpm build` builds the standalone storefront and server bundle.
- `pnpm admin:hash-password` prompts for a password twice without echoing it, then prints its salted scrypt hash.

## Vercel + MongoDB Atlas

The Vercel deployment serves the Vite storefront from `dist/public` and routes `/api/*` to `api/[...path].ts`. Node.js 22 is pinned in `package.json`; the SPA fallback leaves API paths available to the serverless function.

Create a MongoDB Atlas database (for example, `little_bazaar`) and a database user that can access only that database. Set `MONGODB_URI` to the connection string with the database name in its path, for example `mongodb+srv://…@cluster.example.net/little_bazaar?retryWrites=true&w=majority`. Allow the Vercel deployment to reach the cluster through Atlas Network Access. Prefer restricted IP access where practical; if your hosting plan does not provide fixed egress IPs and broad access is unavoidable, use a dedicated least-privilege database user and a strong password.

Set these four variables in Vercel **Production** (and in **Preview** if you want preview deployments to use the database):

| Variable | What to enter |
| --- | --- |
| `MONGODB_URI` | The private Atlas connection string, including the database name. |
| `APP_SESSION_SECRET` | A fresh secret from `openssl rand -hex 32`. |
| `STORE_ADMIN_EMAIL` | The one email address allowed to manage the shop. |
| `STORE_ADMIN_PASSWORD_HASH` | Run `pnpm admin:hash-password` in a terminal, then paste the printed hash—not the original password. |

The optional map and auxiliary-service variables are documented in `.env.example`. Email/password sign-in does not require third-party identity credentials. Never put secrets in source files or prefix them with `VITE_`.

## Deploy

From the extracted project directory:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build:static
pnpm dlx vercel link
pnpm dlx vercel deploy --prod
```

After adding the four required variables, redeploy and verify `https://<your-vercel-domain>/api/health`, open `/admin`, sign in with the configured owner email/password, add a product, then place a test cash-on-delivery order. The source ZIP contains no Atlas URI, session secret, password or live hosting credentials.
