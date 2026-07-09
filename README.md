# PSFPredict

PSFPredict is a prediction platform for matches. This repository contains both the frontend application and the backend API service.

## Tech Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Cloudflare Workers, Hono
- **Database:** PostgreSQL (Neon Serverless)
- **ORM:** Drizzle ORM

## Environment Variables

For local development and deployment, you need to configure the following environment variables in `.dev.vars` (for Wrangler local) and in Cloudflare settings (for production):

- `DATABASE_URL`: Connection string to your PostgreSQL database (e.g., Neon).
- `ESPN_SCOREBOARD_URL`: URL to fetch ESPN scoreboard data.
- `ESPN_KNOCKOUT_DATES`: Dates for knockout matches.
- `ADMIN_EMAIL`: Administrator email.
- `ADMIN_TOKEN`: Optional admin authentication token.

## Commands

- `npm install`: Install dependencies.
- `npm run dev`: Start both frontend (Vite) and backend (Wrangler) locally.
- `npm run typecheck`: Run TypeScript type checking.
- `npm run db:generate`: Generate Drizzle migrations based on your schema.
- `npm run db:migrate`: Apply pending Drizzle migrations to your database.
- `npm run deploy:worker`: Deploy the Cloudflare Worker to production.
- `npm run deploy:web`: Build the React app and deploy it to Cloudflare Pages.

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.dev.vars` file in the `worker/` directory with your local environment variables (specifically `DATABASE_URL`).

3. Start the development server (runs both Web and Worker):
   ```bash
   npm run dev
   ```

The backend is powered by Cloudflare Workers and uses PostgreSQL (Neon) with Drizzle ORM for data persistence.
