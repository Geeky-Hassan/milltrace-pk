# MillTrace PK

MillTrace PK is a role-based MVP for sugar mill traceability, anti-diversion, anti-theft, and tax-compliance monitoring in Pakistan.

It demonstrates one complete sugar flow:

Login as a role -> create cane intake -> create production batch -> generate and activate serials -> receive stock into warehouse -> dispatch with invoice -> confirm buyer receipt -> review exceptions -> inspect audit logs.

## Problem Being Solved

Sugar supply chains can lose accountability through weighbridge manipulation, cane intake suppression, underreported production, skipped serials, warehouse leakage, dispatch without invoice evidence, fake buyer receipts, manual overrides, and weak audit trails.

MillTrace PK gives mill owners, FBR officers, government teams, and auditors one shared evidence layer.

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- API base path: `/api/v1`
- Demo auth: signed role token after role selection
- Audit integrity: local hash-chain with `event_hash` and `previous_event_hash`

## MVP Scope

Implemented:

- role-based demo login
- dashboard with risk score and compliance intelligence
- cane intake validation
- production mass balance and recovery variance
- serial generation and lifecycle
- warehouse receipt tracking
- dispatch validation with invoice requirement
- buyer receipt matching
- exceptions and audit logs
- seed data load/clear controls
- Scope & Solution Map
- End-to-End Flow
- Scenario Lab
- Trace One Batch
- Roles & Responsibilities

## Simulated In MVP

- Weighbridge data is manually entered or seeded.
- FBR tax stamp/UIM data uses internal serial numbers.
- Blockchain is simulated through the audit hash chain.
- Buyer receipt is simulated through dashboard actions.
- Production counters use batch output values.
- GPS/e-bilty and live FBR integrations are not connected yet.

## Future Integrations

- real weighbridge API
- FBR Track & Trace / UIM
- ERP/inventory system
- packaging line PLC or hopper counter
- checkweigher
- CCTV/NVR metadata
- e-invoice
- e-bilty/cargo tracking
- buyer/distributor mobile app
- farmer payment verification
- permissioned ledger or blockchain anchoring

## Local Setup

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
cd ..
docker compose up -d postgres
cd backend
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. API docs are at `http://localhost:8000/docs`.

## Environment Variables

Backend:

```bash
DATABASE_URL=postgresql+psycopg://milltrace:milltrace@localhost:5432/milltrace_pk
FRONTEND_URL=http://localhost:3000
SEED_DEMO_DATA=true
REPAIR_DEMO_SCHEMA_ON_STARTUP=true
DEFAULT_EXPECTED_RECOVERY_PERCENTAGE=10.5
ACTIVATED_WAREHOUSE_LIMIT_HOURS=24
DISPATCH_RECEIPT_LIMIT_HOURS=48
DEMO_JWT_SECRET=change-this-demo-secret
DUPLICATE_VEHICLE_WINDOW_MINUTES=20
MAX_REASONABLE_RECOVERY_PERCENTAGE=14.5
MIN_REASONABLE_RECOVERY_PERCENTAGE=8.0
ALLOWED_WAREHOUSE_LOCATIONS=WH-A / Bay 03,WH-B / Bay 01
```

Frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

For Vercel Services, use:

```bash
NEXT_PUBLIC_API_URL=https://<your-domain>/api/v1
FRONTEND_URL=https://<your-domain>
```

## Seed And Clear Demo Data

The backend seeds reference data and operational demo data when `SEED_DEMO_DATA=true`.

Seed data includes:

- 1 sugar mill
- 3 farmers/suppliers
- 2 production batches
- 100 packaging serials
- 2 warehouse locations
- 3 dispatches
- 2 buyers/distributors
- 8-12 exception alerts
- 20+ audit log records

API commands:

```bash
curl -X POST http://localhost:8000/api/v1/demo/seed -H "Authorization: Bearer <demo-token>"
curl -X DELETE http://localhost:8000/api/v1/demo/seed -H "Authorization: Bearer <demo-token>"
curl -X POST http://localhost:8000/api/v1/demo/reset -H "Authorization: Bearer <demo-token>"
```

Dashboard buttons:

- **Load Seed Data** adds the demo dataset without duplicating it.
- **Clear Demo Data** removes operational demo records only.
- Roles, demo users, mill settings, and suppliers remain after clear.

## Role Definitions

- Mill Owner: views dashboard, production, warehouse, dispatch, exceptions, and audit logs.
- Mill Operator: creates cane intake, creates production batches, generates and activates serials.
- Warehouse Manager: creates warehouse receipts, dispatches, and buyer receipts.
- FBR Officer: views compliance dashboard, exceptions, serial lifecycle, and audit logs; marks exceptions in review.
- Government Admin: views high-level dashboard, scope, risk status, roles, and settings.
- Auditor: views exceptions and audit logs; resolves or dismisses exceptions with reason.

See `/roles` for the visual role page.

## Main Pages

- `/` login
- `/dashboard` metrics, risk, and seed controls
- `/flow` end-to-end process map
- `/scope` scope and solution map
- `/scenario-lab` best-to-worst test cases
- `/trace-batch` batch lifecycle timeline
- `/roles` role responsibilities
- `/dashboard/cane-intake`
- `/dashboard/production`
- `/dashboard/packaging`
- `/dashboard/warehouse`
- `/dashboard/dispatch`
- `/dashboard/buyer-receipts`
- `/dashboard/exceptions`
- `/dashboard/audit-logs`
- `/dashboard/settings`

## API Routes

- `POST /api/v1/auth/demo-login`
- `GET /api/v1/dashboard/summary`
- `POST /api/v1/demo/seed`
- `DELETE /api/v1/demo/seed`
- `POST /api/v1/demo/reset`
- `GET /api/v1/demo/scenarios`
- `POST /api/v1/demo/scenarios/{scenario_id}/run`
- `GET /api/v1/demo/scenarios/{scenario_id}/result`
- `GET /api/v1/demo/gap-map`
- `GET /api/v1/demo/trace/{batch_id}`
- `GET|POST|PATCH|DELETE /api/v1/cane-intakes`
- `GET|POST|PATCH|DELETE /api/v1/production-batches`
- `GET|POST /api/v1/packaging-serials`
- `POST /api/v1/packaging-serials/generate`
- `POST /api/v1/packaging-serials/{serial_number}/transition`
- `GET|POST|PATCH|DELETE /api/v1/warehouse-receipts`
- `GET|POST|PATCH|DELETE /api/v1/dispatches`
- `GET|POST|PATCH|DELETE /api/v1/buyer-receipts`
- `GET /api/v1/exceptions`
- `PATCH /api/v1/exceptions/{id}/resolve`
- `GET /api/v1/audit-logs`

## Test Commands

Backend:

```bash
cd backend
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Suggested Demo Flow

1. Login as Mill Owner and open `/scope`.
2. Open `/flow` to explain the full chain.
3. Open Dashboard and use **Load Seed Data**.
4. Open Scenario Lab and run **Fully Compliant Flow**.
5. Open Trace One Batch for `BATCH-2026-A01`.
6. Run **Serial Gap Detected** and **Dispatch Without Invoice**.
7. Login as FBR Officer and mark an exception `IN_REVIEW`.
8. Login as Auditor and resolve or dismiss an exception with reason.
9. Use **Clear Demo Data** and manually create the clean flow.

See [Final Demo Flow](docs/FINAL_DEMO_FLOW.md), [MVP Demo Script](docs/MVP_DEMO_SCRIPT.md), [Scope And Assumptions](docs/SCOPE_AND_ASSUMPTIONS.md), and [Scenario Testing Guide](docs/SCENARIO_TESTING_GUIDE.md).

## Known MVP Limitations

- Demo auth is not production identity management.
- Alembic migrations are not yet configured.
- Real mill hardware is not connected.
- FBR UIM/tax stamp integration is simulated.
- Blockchain anchoring is local hash-chain only.
- Legal enforcement remains outside the product.

## GitHub Push Checklist

```bash
git status
git add .
git commit -m "Polish MillTrace PK demo flow"
git push origin main
```

Before pushing, run backend tests and frontend lint/build.
