This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Platform mode

Run both services from the platform repo:

```powershell
npm run platform:dev
```

Run unified regression:

```powershell
npm run platform:test
```

FastAPI business endpoints will use the platform route boundary under `/api/biz/*`.

## Unified platform deployment boundary

Run the container boundary for Next.js, FastAPI, Nginx, Postgres, Redis, and MinIO:

```powershell
docker compose -f infra\docker-compose.platform.yml up -d proxy web biz-api
```

Smoke the unified boundary:

```powershell
Invoke-WebRequest http://localhost:3003/api/health -UseBasicParsing
Invoke-WebRequest http://localhost:3003/api/biz/health -UseBasicParsing
```

Stop the boundary:

```powershell
docker compose -f infra\docker-compose.platform.yml down
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
