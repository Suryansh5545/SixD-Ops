#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# SixD Ops — One-click launcher
# Double-click this file on Mac to start the app.
# ─────────────────────────────────────────────────────────────────────────────

# Change to the project directory
cd "$(dirname "$0")"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║         SixD Ops Tool — Starting Up              ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# ── Add Postgres.app to PATH ──────────────────────────────────────────────────
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

# ── Load environment variables ────────────────────────────────────────────────
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# ── Check if PostgreSQL is reachable ─────────────────────────────────────────
echo "→ Checking database connection..."
if ! pg_isready -q 2>/dev/null; then
  echo ""
  echo "⚠️  PostgreSQL is not running!"
  echo "   Please open Postgres.app and click Start, then run this script again."
  echo ""
  read -p "Press Enter to exit..."
  exit 1
fi
echo "  ✓ PostgreSQL is running"

# ── Create database if it doesn't exist ──────────────────────────────────────
echo "→ Checking database 'sixd_ops'..."
DB_EXISTS=$(psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -w sixd_ops | wc -l | tr -d ' ')
if [ "$DB_EXISTS" = "0" ]; then
  echo "  Creating database..."
  createdb sixd_ops 2>/dev/null && echo "  ✓ Database created" || echo "  ✓ Database already exists"
else
  echo "  ✓ Database exists"
fi

# ── Fix DATABASE_URL to use current system user if needed ─────────────────────
CURRENT_USER=$(whoami)
# Replace placeholder credentials with current user (Postgres.app uses OS username, no password)
if grep -q "postgresql://postgres:postgres@" .env 2>/dev/null; then
  sed -i '' "s|postgresql://postgres:postgres@localhost:5432/sixd_ops|postgresql://$CURRENT_USER@localhost:5432/sixd_ops|g" .env
  export DATABASE_URL="postgresql://$CURRENT_USER@localhost:5432/sixd_ops"
  echo "  ✓ DATABASE_URL updated for user: $CURRENT_USER"
fi

# ── Run Prisma migrations ─────────────────────────────────────────────────────
echo ""
echo "→ Running database migrations..."
npx prisma migrate deploy 2>&1 | tail -5
echo "  ✓ Migrations done"

# ── Check if database needs seeding ──────────────────────────────────────────
echo "→ Checking if database needs seeding..."
USER_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM \"User\";" 2>/dev/null | tr -d ' ')
if [ -z "$USER_COUNT" ] || [ "$USER_COUNT" = "0" ]; then
  echo "  Seeding database with users and initial data..."
  npm run db:seed 2>&1 | tail -10
  echo "  ✓ Database seeded"
else
  echo "  ✓ Database already has $USER_COUNT users — skipping seed"
fi

# ── Start the app ─────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   ✅  SixD Ops is starting!                       ║"
echo "║                                                  ║"
echo "║   Open in browser:  http://localhost:3000        ║"
echo "║                                                  ║"
echo "║   Login: pawan@sixdengineering.com               ║"
echo "║   Password: SixD@2024                            ║"
echo "║                                                  ║"
echo "║   Close this window to stop the server.          ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

npm run dev
