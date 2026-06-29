# MillTrace PK

MillTrace PK is a role-based MVP for sugar mill traceability, anti-diversion, anti-theft, and tax-compliance monitoring in Pakistan.

It tracks the chain from cane intake to production, packaging serials, warehouse custody, dispatch, buyer receipt, exceptions, risk scoring, and tamper-evident audit logs.

## Problem Being Solved

Sugar supply chains can lose accountability at several points:

- cane intake and weighbridge manipulation
- suppressed or underreported production
- recovery percentage manipulation
- skipped or duplicate serials
- leakage between packaging and warehouse
- dispatch without invoice evidence
- fake or wrong buyer receipt
- manual override abuse
- weak audit trail

MillTrace PK gives mill owners, FBR officers, government teams, and auditors a shared evidence layer.

## MVP Scope

Implemented in this MVP:

- demo role-based login
- cane intake records
- production batch creation
- expected vs actual sugar output
- recovery variance detection
- serial generation and lifecycle
- warehouse receipt tracking
- dispatch validation
- buyer receipt matching
- exception alerts
- audit logs with hash chain
- compliance risk score
- Scope & Solution Map
- Scenario Lab
- Trace One Batch timeline

## Simulated In MVP

- Weighbridge data is manually entered or seeded.
- FBR tax stamp/UIM data is represented by internal serial numbers.
- Blockchain is simulated with `event_hash` and `previous_event_hash`.
- Buyer receipt is simulated through dashboard actions.
- Production counters are simulated with batch output values.
- GPS/e-bilty integration is not live yet.

## Future Real Integrations

- real weighbridge API
- FBR Track & Trace / UIM integration
- ERP/inventory integration
- packaging line PLC or hopper counter
- checkweigher integration
- CCTV/NVR metadata
- e-invoice integration
- e-bilty/cargo tracking
- buyer/distributor mobile app
- bank/payment verification for farmers
- real blockchain or permissioned ledger anchoring

## Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy
- Database: PostgreSQL
- API base path: `/api/v1`
- Demo auth: signed role token stored after role selection

## Setup

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

## Seed And Reset Demo Data

The backend creates tables and seed data on startup when `SEED_DEMO_DATA=true`.

Seed data includes:

- 1 sugar mill
- 3 suppliers
- 2 production batches
- 100 packaging serials
- 2 warehouse locations
- 3 dispatches
- 2 buyers
- 8-12 exception alerts
- 20+ audit logs with event hashes

Reset seeded demo data:

```bash
curl -X POST http://localhost:8000/api/v1/demo/reset ^
  -H "Authorization: Bearer <demo-token>"
```

You can also use **Scenario Lab > Reset Demo Data**.

## Test Commands

Backend:

```bash
cd backend
.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Scenario Lab

The Scenario Lab runs best-to-worst cases and records:

- scenario executed
- gap tested
- expected detection
- actual exceptions
- audit logs created
- risk score impact
- pass/partial result

Key scenarios include:

- Fully Compliant Flow
- Minor Recovery Variance
- Warning Recovery Variance
- Critical Recovery Variance
- Serial Gap Detected
- Duplicate Serial Used
- Dispatch Without Warehouse Receipt
- Dispatch Without Invoice
- Wrong Buyer Receipt
- Buyer Receipt Shortage
- Extra Serial In Buyer Receipt
- Manual Override Abuse
- Cross-Mill Serial Fraud
- Activated Serials Not Warehoused In Time
- Complete Fraud Chain

## Role Permissions

- Mill Owner: view business dashboard, production, stock, dispatch, exceptions, audit logs, scope, scenario lab, and trace timeline.
- Mill Operator: create cane intake, create production batches, activate/void serials with approval, and view production exceptions.
- Warehouse Manager: create warehouse receipts, dispatches, and buyer receipts.
- FBR Officer: view compliance dashboard, exceptions, serial lifecycle, audit logs, and mark exceptions `IN_REVIEW`.
- Government Admin: view high-level dashboard, all mills, exceptions, role management, settings, scope, and scenarios.
- Auditor: view audit logs and exceptions; resolve or dismiss exceptions only with reason.

Backend middleware checks signed demo tokens and validates permissions for every sensitive endpoint.

## Main API Routes

- `POST /api/v1/auth/demo-login`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/demo/scenarios`
- `POST /api/v1/demo/scenarios/{scenario_id}/run`
- `GET /api/v1/demo/scenarios/{scenario_id}/result`
- `POST /api/v1/demo/reset`
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

## Suggested Live Demo Script

1. Open **Scope & Solution Map** and explain what is implemented, simulated, and future-integrated.
2. Open **Scenario Lab** and run **Fully Compliant Flow**.
3. Open **Trace One Batch** and show the timeline.
4. Run **Serial Gap Detected** and **Dispatch Without Invoice**.
5. Open **Dashboard** and show Compliance Intelligence.
6. Login as **FBR Officer** and mark an exception `IN_REVIEW`.
7. Login as **Auditor** and resolve or dismiss an exception with reason.
8. Run **Complete Fraud Chain** and show how multiple weak signals raise critical risk.

Detailed scripts:

- [MVP Demo Script](docs/MVP_DEMO_SCRIPT.md)
- [Scope And Assumptions](docs/SCOPE_AND_ASSUMPTIONS.md)
- [Scenario Testing Guide](docs/SCENARIO_TESTING_GUIDE.md)

## Known MVP Limitations

- Demo auth is not production identity management.
- Alembic migrations are not yet configured.
- Real mill hardware is not connected.
- FBR UIM/tax stamp integration is simulated.
- Blockchain anchoring is local hash-chain only.
- Legal enforcement remains outside the product.

## Future Blockchain Integration

Audit logs already include `event_hash`, `previous_event_hash`, and optional `blockchain_anchor_hash`. A future service can publish periodic anchor hashes to a government notary service, public chain, or permissioned consortium ledger while the operational database remains the system of record.
