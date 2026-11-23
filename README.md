# masstech-api

Backend for masstech.mn — Node.js 22 · Express 5 · TypeScript · Drizzle ORM · Neon PostgreSQL · Cloudinary.
Runs on Render. The website (Next.js on Vercel) reads public content from it, and the `/admin` panel manages it.

## What it does

| | |
| --- | --- |
| Products | CRUD, EN/MN text, category / sub-group, publish toggle, sort order, image on Cloudinary |
| News / projects | CRUD, EN/MN, dates, client, cover + photo gallery on Cloudinary |
| Contact messages | Stores website form submissions, optional e-mail notification (Resend), new / read / archived |
| Admins | E-mail + password (bcrypt), JWT, change password |

Images are uploaded **directly from the browser to Cloudinary** with a signature from the API, so files never pass through Render.
Replaced or deleted images are removed from Cloudinary automatically.

## API

Public (no auth) – base `/v1`

| Method | Path | |
| --- | --- | --- |
| GET | `/products?category=&group=` | published products |
| GET | `/products/:slug` | |
| GET | `/projects` | published projects, newest first |
| GET | `/projects/:slug` | |
| POST | `/contact` | `{ name, phone, email, organization?, message, product?, locale? }` — 5 per 10 min per IP |
| GET | `/health` | DB check (Render health check) |

Auth – `/v1/auth`: `POST /login` → `{ token }` (10 tries / 15 min), `GET /me`, `POST /password`

Admin (header `Authorization: Bearer <token>`) – `/v1/admin`
`GET /stats` · `GET|POST /products` · `GET|PUT|DELETE /products/:id` · `GET|POST /projects` · `GET|PUT|DELETE /projects/:id` ·
`GET /messages?status=&limit=&offset=` · `PATCH|DELETE /messages/:id` · `POST /uploads/sign {folder}` · `POST /uploads/destroy {publicId}`

## Deploy (one time)

**1. Neon** – create a project (region: AWS Singapore `ap-southeast-1`), database `masstech`.
Copy the **pooled** connection string (`...-pooler...?sslmode=require`).

**2. Cloudinary** – Dashboard → *API Keys*: copy Cloud name, API key, API secret.

**3. Render** – push this folder to its own GitHub repo, then Render → *New* → *Blueprint* → pick the repo.
`render.yaml` creates the service; fill in when asked:
`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (min 10 chars), `CLOUDINARY_*`, optionally `RESEND_API_KEY` + `CONTACT_FROM_EMAIL`.
`JWT_SECRET` is generated automatically.

On first start the service runs migrations and creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

**4. Import the current website content** (50 products, 12 projects) – once, from your computer:

```bash
cp .env.example .env      # put the Neon DATABASE_URL in it
npm install
npm run seed              # safe to re-run; existing slugs are skipped
```

**5. Vercel** (website project) → Settings → Environment Variables → `API_URL = https://masstech-api.onrender.com`
(your Render URL), then redeploy. Open `https://masstech.mn/admin`.

## Local development

```bash
cp .env.example .env   # fill DATABASE_URL (a Neon dev branch works well) and JWT_SECRET
npm install
npm run dev            # http://localhost:4000
```

Other scripts: `npm run build`, `npm start`, `npm run db:generate` (after editing `src/db/schema.ts`),
`npm run create-admin -- email@x.mn 'password' "Name"` (create admin or reset a password).

## Notes

- **Render free plan sleeps** after 15 minutes without traffic; the first request then takes ~50 s.
  The public site is not affected (pages are cached on Vercel and fall back to the last good version),
  but the contact form and admin login can be slow after idle time. The *Starter* plan ($7/month) stays awake.
- Seeded project photos keep their `/images/projects/...` paths (served by the website). New uploads go to Cloudinary.
- Migrations live in `drizzle/` and run automatically on every start.
