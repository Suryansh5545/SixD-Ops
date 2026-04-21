@echo off
cd /d "%~dp0"

echo.
echo ==========================================
echo   SixD Ops Tool — Starting Up
echo ==========================================
echo.

REM ── Load .env variables ──
if exist .env (
  for /f "usebackq tokens=1,2 delims==" %%a in (.env) do (
    if not "%%a"=="" set %%a=%%b
  )
)

REM ── Check PostgreSQL ──
echo → Checking database connection...
pg_isready >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo ⚠ PostgreSQL is not running!
  echo Please start PostgreSQL and try again.
  pause
  exit /b
)
echo ✓ PostgreSQL is running

REM ── Check DB existence ──
echo → Checking database 'sixd_ops'...
psql -lqt | findstr sixd_ops >nul
if %errorlevel% neq 0 (
  echo Creating database...
  createdb sixd_ops
  echo ✓ Database created
) else (
  echo ✓ Database exists
)

REM ── Run migrations ──
echo.
echo → Running database migrations...
npx prisma migrate deploy
echo ✓ Migrations done

REM ── Check seeding ──
echo → Checking if database needs seeding...
for /f %%i in ('psql "%DATABASE_URL%" -t -c "SELECT COUNT(*) FROM \"User\";"') do set USER_COUNT=%%i

if "%USER_COUNT%"=="" (
  echo Seeding database...
  npm run db:seed
  echo ✓ Database seeded
) else (
  echo ✓ Database already has %USER_COUNT% users
)

echo.
echo ==========================================
echo   SixD Ops is starting!
echo   http://localhost:3000
echo ==========================================
echo.

npm run dev
pause