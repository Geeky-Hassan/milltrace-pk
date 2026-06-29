# Scope And Assumptions

## What This MVP Solves

MillTrace PK proves the operational and compliance workflow for one demo sugar mill:

- cane intake is recorded with supplier, vehicle, collection point, and net weight
- production batches link to cane intake records
- expected sugar output is compared with actual output
- packaging serials follow a controlled lifecycle
- warehouse custody is serial-level
- dispatch requires serialized stock and invoice evidence
- buyer receipt is matched against dispatch buyer and serials
- exception alerts explain gaps and suggested actions
- audit logs preserve actor, role, old/new values, and hash-chain evidence
- dashboard risk score summarizes compliance pressure

## What It Does Not Solve Yet

- It does not connect to real weighbridge hardware.
- It does not connect to FBR Track & Trace / UIM systems.
- It does not connect to ERP or accounting systems.
- It does not ingest live packaging line PLC or checkweigher data.
- It does not use live GPS/e-bilty tracking.
- It does not provide legal enforcement.
- It does not replace mill SOPs, tax law, or government inspection.

## Assumptions

- One demo mill is enough to prove the control model.
- Internal serials can stand in for FBR UIM/tax stamps during demo.
- Manual forms are acceptable before hardware/API integration.
- Exceptions should flag risk, not automatically declare fraud.
- Audit hash chaining is useful even before external ledger anchoring.
- Role-based controls are required even in an MVP.

## Risks

- Manual demo data can differ from live operational behavior.
- Real mill integrations may expose data quality problems.
- FBR integration requirements may require schema changes.
- Warehouse scanner adoption is critical for reliable serial custody.
- Users may need training to treat exceptions as review workflows.
- Legal admissibility of audit evidence must be validated before pilot.

## Future Integrations

- real weighbridge API
- FBR Track & Trace / UIM
- mill ERP and inventory system
- packaging line PLC / hopper counter
- checkweigher
- CCTV/NVR metadata
- e-invoice
- e-bilty/cargo tracking
- buyer/distributor mobile app
- farmer bank/payment verification
- permissioned ledger or government notary anchoring

## Validation Questions Before Pilot

- Which weighbridge systems are installed at target mills?
- Which FBR UIM data fields must be captured at bag level?
- Which ERP owns inventory and dispatch records?
- Where are serials physically printed or scanned?
- Who can approve voids and manual overrides?
- What receipt evidence can buyers realistically provide?
- What exception severity requires FBR notification?
- What audit retention period is required?
- Which reports are needed for mill owners, FBR, and government admins?
