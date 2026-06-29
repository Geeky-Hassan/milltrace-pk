# MillTrace PK Architecture

## Workflow

1. Cane intake records farmer or supplier, vehicle, weighbridge values, collection point, operator, and status.
2. Production batch records shift-level cane input, expected sugar output, actual sugar output, recovery percentage, and variance status.
3. Packaging serials connect bag-level serial numbers to production batches.
4. Warehouse receipts place serial ranges into locations with stock age and status.
5. Dispatch records attach buyers, vehicles, invoices, and serial ranges to outbound movement.
6. Buyer receipts confirm received quantity and shortage or mismatch claims.
7. Exception alerts flag serial gaps, duplicate serials, output variance, dispatch issues, buyer receipt gaps, weighbridge mismatches, and manual overrides.
8. Audit logs preserve evidence events for review.

## Backend Modules

- `app/main.py`: FastAPI app, CORS, startup table creation, demo seeding
- `app/models.py`: SQLAlchemy models
- `app/schemas.py`: Pydantic request and response schemas
- `app/api/v1/router.py`: `/api/v1` route definitions
- `app/db/seed.py`: one-mill demo dataset
- `app/db/database.py`: SQLAlchemy engine and session dependency

## Frontend Modules

- `app/page.tsx`: demo login by role
- `app/dashboard/*`: role-aware dashboard modules
- `components/*`: shared shell, cards, tables, badges, lifecycle visual
- `lib/api.ts`: backend API client with demo fallback data
- `lib/demo-data.ts`: local fallback dataset
- `lib/roles.ts`: role labels, capabilities, and navigation rules

## Data Model

Core tables:

- `users`
- `roles`
- `mills`
- `farmer_suppliers`
- `cane_intakes`
- `production_batches`
- `packaging_serials`
- `warehouse_receipts`
- `dispatches`
- `buyer_receipts`
- `exception_alerts`
- `audit_logs`

## Next Extensions

- Add Alembic migrations.
- Replace demo login with token-backed authentication.
- Add per-mill tenancy filters to every route.
- Add serial range expansion and validation for warehouse and dispatch.
- Add immutable audit log writes from every mutation endpoint.
- Add evidence attachment storage for weighbridge slips, dispatch challans, invoices, and buyer acknowledgements.
