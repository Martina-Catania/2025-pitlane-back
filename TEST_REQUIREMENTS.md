# Test Requirements

## Prerequisites

1. **PostgreSQL installed and running locally**
2. **Node.js and npm installed**
3. **Prisma CLI installed** (`npm install -g prisma` or use `npx prisma`)

## Test Database Setup

The test suite uses a separate local PostgreSQL database to avoid affecting your development/production data.

### Configuration

- **Database:** `pitlane_test`
- **User:** `postgres`
- **Password:** `testpassword123`
- **Port:** configure in `.env.test` (commonly `5432` or `5433`)
- **Connection String:** configure in `.env.test`

Example:

```bash
DATABASE_URL="postgresql://postgres:testpassword123@localhost:5432/pitlane_test?schema=public"
DIRECT_URL="postgresql://postgres:testpassword123@localhost:5432/pitlane_test?schema=public"
```

## Running Tests

### 1. Ensure Local PostgreSQL Is Running

Start your local PostgreSQL service and make sure the `pitlane_test` database exists.

### 2. Run Tests

```bash
npm test
```

The test script automatically:
- Checks PostgreSQL connectivity using `DATABASE_URL`
- Runs Prisma migrations
- Seeds the test database
- Executes all test suites
- Cleans up after completion

### 3. Optional: Prepare or Reset Test DB Manually

```bash
npm run test:db:prepare
npm run test:db:reset
```

## Manual Testing with Postman

To test API endpoints manually using the test database:

### 1. Ensure Local PostgreSQL Is Running
```bash
# Example (Windows service name may vary)
Get-Service *postgres* 
```

### 2. Run Migrations (first time only)
```bash
$env:DATABASE_URL="postgresql://postgres:testpassword123@localhost:5432/pitlane_test?schema=public"
npx prisma migrate deploy
```

### 3. Start API Server with Test Database
```bash
$env:DATABASE_URL="postgresql://postgres:testpassword123@localhost:5432/pitlane_test?schema=public"
npm start
```

### 4. Make Requests in Postman
- **Base URL:** `http://localhost:3000`
- All requests will use the test database

## Test Structure

- **Test Files:** Located in `/test` directory
- **Test Database:** Isolated from development data
- **Seed Data:** Automatically created before each test run
- **Cleanup:** Database reset after tests complete

## Common Issues

### Database Does Not Exist
Create it manually in PostgreSQL:

```sql
CREATE DATABASE pitlane_test;
```

### Database Connection Errors
Check local PostgreSQL service status and `.env.test` credentials/port:

```bash
Get-Service *postgres*
```

### Migration Errors
Reset the test database:
```bash
npm run test:db:reset
```

## Notes

- The test database is completely separate from your development database
- Test data is seeded automatically before each test run
- All tests should be idempotent and not depend on execution order
