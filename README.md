# Aim4price Tractors Valuation Frontend

This package is intentionally narrowed to the two pages that matter right now:

- `/` home page
- `/valuation` valuation flow
- `/valuations` alias route that points to the same valuation experience

## What is included

- premium homepage styling aligned to the newer Aim4price direction
- photographic hero on the homepage
- generic visuals after the hero so the product system stays cleaner and more consistent
- tractors-only guided valuation flow
- professional result screen with value-stack comparison
- Railway-friendly Next.js project structure

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm install
npm run build
npm run start
```

## Railway

1. Push this folder to a new GitHub repository.
2. Create a new Railway project from that repository.
3. Let Railway install dependencies and run the default Next.js build.
4. Set a domain in Railway.
5. Open `/` or `/valuation`.

No custom Dockerfile is required.
