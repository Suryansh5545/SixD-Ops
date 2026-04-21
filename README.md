# SixD Ops Tool

**SixD Engineering Solutions Pvt. Ltd. — Operations Management Platform**

Replaces WhatsApp + paper + Excel workflows with a single digital system:
PO receipt → field execution → invoicing → payment collection.

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18.17+ |
| PostgreSQL | 15+ |
| npm | 9+ |

---

## Local Development Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd sixd-ops
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/sixd_ops
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your-app-password
EMAIL_FROM="SixD Ops <noreply@sixdengineering.com>"
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
APP_URL=http://localhost:3000
SESSION_EXPIRY_HOURS=8
CRON_SECRET=any-long-random-string
DEFAULT_GST_PERCENT=18
COMPANY_NAME="SixD Engineering Solutions Pvt. Ltd."
COMPANY_ADDRESS="Noida, Uttar Pradesh, India"
COMPANY_GSTIN=07AAJCS1234A1Z5
COMPANY_PAN=AAJCS1234A
COMPANY_EMAIL=info@sixdengineering.com
COMPANY_PHONE="+91-XXXXXXXXXX"
COMPANY_BANK_NAME="HDFC Bank"
COMPANY_BANK_ACCOUNT=XXXXXXXXXXXXXXXXXX
COMPANY_BANK_IFSC=HDFC0001234
COMPANY_BANK_BRANCH="Noida Branch"
```

### 3. Create PostgreSQL database

```bash
createdb sixd_ops
# or via psql:
psql -U postgres -c "CREATE DATABASE sixd_ops;"
```

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Seed with initial data

```bash
npm run db:seed
```

This creates:
- All user accounts (see table below)
- All engineers (TS + LS&S divisions)
- Clients: Tata Steel, SAIL, JSW Steel
- Compliance document types (8 types)
- Equipment (4 units)

### 6. Start development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Seed User Accounts

Default password for all users: **`SixD@2024`**  
Default PIN for field engineers: **`123456`**

| Name | Email | Role |
|------|-------|------|
| Pawan | pawan@sixdengineering.com | MD |
| Vinay Mishra | vinay.mishra@sixdengineering.com | CFO |
| Vaibhav Tyagi | vaibhav.tyagi@sixdengineering.com | Business Head |
| Nidhi Bharti | nidhi.bharti@sixdengineering.com | BM – Steel |
| Syed Ali | syed.ali@sixdengineering.com | PM + BM TATA (dual role) |
| Gaurav | gaurav@sixdengineering.com | Project Manager |
| Suraj Pandey | suraj.pandey@sixdengineering.com | BD Team |
| Yash Patel | yash.patel@sixdengineering.com | BD Team |
| Admin Coordinator | admin@sixdengineering.com | Admin Coordinator |
| Accounts Team | accounts@sixdengineering.com | Accounts |
| Digivijay | digivijay@sixdengineering.com | Field Engineer (TS Head) |
| Kaleem | kaleem@sixdengineering.com | Field Engineer (LSS Head) |
| Santosh, Rama, + 18 others | *@sixdengineering.com | Field Engineers |

---

## Production Deployment (VPS / Linux)

### 1. Build the application

```bash
npm run build
```

### 2. Start the production server

```bash
npm start
# Or with PM2 for process management:
npm install -g pm2
pm2 start npm --name "sixd-ops" -- start
pm2 save
pm2 startup
```

### 3. Nginx reverse proxy (recommended)

```nginx
server {
    listen 80;
    server_name ops.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Add SSL with Certbot: `certbot --nginx -d ops.yourdomain.com`

### 4. Environment notes for production

- Set `APP_URL` to your domain (e.g. `https://ops.sixdengineering.com`)
- Set `NEXTAUTH_URL` to the same
- Set a strong `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
- Point `DATABASE_URL` to your PostgreSQL instance
- Point `UPLOAD_DIR` to an absolute path with write permissions (e.g. `/var/sixd-ops/uploads`)
- Configure SMTP credentials for email delivery

### 5. Logo

Place `sixd-logo.png` in `public/` for use in invoice PDFs.  
The logo file should be approximately 200×80px PNG with transparent background.

---

## Architecture

```
Stack:
  Frontend:  Next.js 14 (App Router) · TypeScript · Tailwind CSS · shadcn/ui
  Backend:   Next.js API Routes (monorepo — no separate server)
  Database:  PostgreSQL 15 + Prisma ORM
  Auth:      NextAuth.js v5 · JWT sessions · credentials provider
  Storage:   Local filesystem (swap to S3 via StorageService)
  Email:     Nodemailer SMTP (abstracted via EmailService)
  Cron:      node-cron · initialised via Next.js instrumentation.ts
  PDF:       @react-pdf/renderer (invoice generation)
  PWA:       manifest.json + service worker (offline log entry queue)
```

---

## Key Features

| Feature | Location |
|---------|----------|
| PO intake + auto ID generation | `/pos/new` |
| Project lifecycle (18 stages) | `/projects/[id]` |
| Mobile clock in/out | `/projects/[id]/logsheet` |
| Expense submit + PM approval | `/projects/[id]/expenses` |
| Compliance gate on invoicing | `/projects/[id]/invoice` |
| Invoice PDF generation | `/api/invoices/[id]/pdf` |
| Payment recording | `/api/invoices/[id]/payments` |
| Tally CSV export | Invoices list page |
| Payment reminders | `node-cron` → `/api/cron/payment-reminders` |
| Compliance expiry alerts | `node-cron` → `/api/cron/compliance-expiry` |
| In-app notifications | Bell icon in topbar |
| Offline log entry (PWA) | `public/sw.js` + IndexedDB |
| Dark mode | Toggle in topbar |
| RBAC | `src/lib/rbac.ts` |
| Audit trail | AuditLog table — every status change |

---

## Useful Commands

```bash
npm run dev           # Start development server
npm run build         # Production build
npm start             # Start production server
npm run db:migrate    # Run Prisma migrations
npm run db:seed       # Seed database
npm run db:studio     # Open Prisma Studio (database browser)
npm run db:reset      # Reset DB and re-seed (DESTRUCTIVE)
npm run lint          # ESLint
```

---

## Support

For technical issues, contact the development team or refer to the PRD document.

---

*SixD Engineering Solutions Pvt. Ltd. · Noida, India · ISO 9001:2015 Certified*
