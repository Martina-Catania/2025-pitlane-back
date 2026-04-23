# PID - QueComemos Backend

Backend API for QueComemos, built with Express and Prisma.

## Setup

1. Install dependencies with `npm install`.
2. Create a local `.env` file with your PostgreSQL connection strings.
3. Make sure PostgreSQL is running locally before starting the app.
4. Run `npm start` to launch the API.

Prisma client generation runs automatically before start through `prestart`.

## Database And Tests

The test suite expects a separate PostgreSQL database named `pitlane_test` with these defaults:

- User: `postgres`
- Password: `testpassword123`
- Port: `5432` or `5433`, depending on your local setup

Recommended test connection strings:

```bash
DATABASE_URL="postgresql://postgres:testpassword123@localhost:5432/pitlane_test?schema=public"
DIRECT_URL="postgresql://postgres:testpassword123@localhost:5432/pitlane_test?schema=public"
```

## Useful Commands

- `npm test` - run the full test suite
- `npm run test:db:prepare` - apply migrations and seed the test database
- `npm run test:db:reset` - reset the test database
- `npm run seed` - seed the database manually
- `npm run migrate-dev` - create and apply a new migration, then run triggers

## Notes

- If you change Prisma schema files, run the migration flow before testing.
- Keep the development database separate from the test database.
