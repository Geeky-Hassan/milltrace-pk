# Final Demo Flow

This guide shows the cleanest MillTrace PK walkthrough for mill owners, FBR officers, government teams, auditors, and technical partners.

## 1. Run The Project

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## 2. Load Seed Data

Login as **Mill Owner**.

Open **Dashboard** and click **Load Seed Data**.

Show stakeholders:

- seeded cane intake, production, serials, warehouse, dispatch, receipt, exceptions, and audit logs
- risk score and top compliance risks
- no duplicate seed data if the button is clicked again

## 3. Clear Seed Data

Open **Dashboard** and click **Clear Demo Data**.

Confirm the warning:

`This will clear demo operational data only. Roles and system settings will remain.`

Show stakeholders:

- operational records are cleared
- roles, users, mill settings, and suppliers remain
- the system is ready for a manual end-to-end test

## 4. Manual Clean Flow

Login as **Mill Operator**.

1. Open **Cane Intake** and create a valid intake.
2. Open **Production** and select the created cane intake.
3. Create a production batch with normal output.
4. Open **Packaging & Serials**.
5. Generate serials for the batch.
6. Activate issued serials.

Login as **Warehouse Manager**.

1. Open **Warehouse** and receive activated serials.
2. Open **Dispatch** and create a dispatch with buyer, vehicle, driver, invoice, and warehoused serials.
3. Open **Buyer Receipt** and confirm receipt for the dispatch.

Show stakeholders:

- serials move forward only
- warehouse accepts only activated serials
- dispatch accepts only warehoused serials with invoice
- buyer receipt must match buyer and serials
- audit logs are created for sensitive actions

## 5. Problem Cases

Open **Scenario Lab**.

Run these cases:

- **Warning Recovery Variance**
- **Critical Recovery Variance**
- **Serial Gap Detected**
- **Duplicate Serial Used**
- **Dispatch Without Warehouse Receipt**
- **Dispatch Without Invoice**
- **Wrong Buyer Receipt**
- **Buyer Receipt Shortage**
- **Complete Fraud Chain**

Show stakeholders:

- exceptions are created automatically
- high and critical risks rise to the top
- risk score changes after scenarios
- audit logs preserve who did what and when

## 6. Role Walkthrough

Use these roles:

- **Mill Owner**: dashboard, stock, production, exceptions, audit overview
- **Mill Operator**: cane intake, production, serial activation
- **Warehouse Manager**: warehouse receipt, dispatch, buyer receipt
- **FBR Officer**: compliance dashboard, exceptions, audit logs, mark in review
- **Auditor**: audit logs, exception evidence, resolve or dismiss with reason
- **Government Admin**: high-level scope, dashboard, risk status, settings

## 7. Stakeholder Highlights

Show these pages:

- **Scope & Solution Map**: what is solved, simulated, and future-integrated
- **End-to-End Flow**: clear stage-by-stage process
- **Scenario Lab**: proof that loopholes are detected
- **Trace One Batch**: one batch from intake to audit trail
- **Exceptions**: compliance work queue
- **Audit Logs**: tamper-evident event history

## 8. MVP Limitations To State Clearly

- Real weighbridge data is not connected yet.
- FBR UIM/tax stamp integration is simulated.
- Blockchain anchoring is represented by local hash-chain audit logs.
- Production counters are manually entered in this MVP.
- Legal enforcement remains outside the software.
