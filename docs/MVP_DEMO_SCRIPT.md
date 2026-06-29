# MillTrace PK MVP Demo Script

Use this walkthrough for a live stakeholder demo. Keep the story simple: every movement creates evidence, every mismatch creates an exception, and every review leaves an audit trail.

## 1. Start With Scope & Solution Map

1. Open `http://localhost:3000`.
2. Login with any demo role.
3. Open **Scope & Solution Map**.
4. Explain what is implemented, what is simulated, and what needs future integration.

Point to make: stakeholders should understand the problem, MVP scope, and future integration plan in under 2 minutes.

## 2. Run Scenario Lab

1. Open **Scenario Lab**.
2. Run **Fully Compliant Flow**.
3. Run **Serial Gap Detected** or **Dispatch Without Invoice**.
4. Show the result panel: expected detection, actual exceptions, audit logs, and risk score impact.

Point to make: the MVP can prove both clean flow and fraud/edge-case detection.

## 3. Trace One Batch

1. Open **Trace One Batch**.
2. Select a seeded batch.
3. Show cane intake, production, serials, warehouse, dispatch, receipt, exceptions, and audit hash.

Point to make: every batch becomes an evidence timeline, not just a production row.

## 4. Login As Mill Operator

1. Open `http://localhost:3000`.
2. Select **Mill Operator**.
3. Show the role-based sidebar: Cane Intake, Production, Packaging, and Red Flags.

Point to make: operators can create operational evidence, but they cannot dispatch stock or resolve compliance exceptions.

## 5. Create Cane Intake

1. Open **Cane Intake**.
2. Create a delivery with supplier, cane ticket, vehicle number, gross weight, tare weight, collection point, and operator name.
3. Submit the form.
4. Show the success toast and new table row.

Point to make: the backend calculates net cane weight, rejects invalid weights, detects duplicate tickets/vehicles, and audit logs the accepted intake.

## 6. Create Production Batch

1. Open **Production Batches**.
2. Enter a shift, linked cane intake IDs, actual sugar output, and downtime explanation if output is low.
3. Submit the form.
4. Show recovery percentage and variance status.

Point to make: production is controlled by mass balance. Expected output uses the configured recovery percentage, and abnormal variance creates an exception.

## 7. Review Packaging Serials

1. Open **Packaging & Serials**.
2. Search by batch or serial.
3. Select a serial and show the lifecycle visual.
4. For a demo control action, void a serial with a reason.

Point to make: serials move forward only. Voids require supervisor approval and create audit evidence.

## 8. Login As Warehouse Manager

1. Use the role selector and choose **Warehouse Manager**.
2. Show that production entry is no longer available.
3. Open **Warehouse**.

Point to make: warehouse staff can receive and dispatch stock, but cannot edit production records.

## 9. Move Serials To Warehouse

1. In **Warehouse**, enter activated serial numbers and select a warehouse location.
2. Submit the receipt.
3. Show the stock table and status colors.

Point to make: only activated serials can enter warehouse custody. Wrong location, duplicate receipt, or quantity mismatch creates an exception.

## 10. Dispatch Stock

1. Open **Dispatch**.
2. Create a dispatch with buyer, vehicle, driver, invoice number, and serials.
3. Submit the dispatch.

Point to make: only warehoused serials can be dispatched. Missing invoice, voided serials, already dispatched serials, or quantity mismatch are flagged.

## 11. Confirm Buyer Receipt

1. Open **Buyer Receipt**.
2. Enter dispatch ID, buyer name, receipt location, and received serials.
3. Submit the receipt.
4. Show any shortage or mismatch status.

Point to make: buyer receipt closes the chain. Shortage, extra serials, wrong buyer, duplicate receipt, or late receipt creates compliance evidence.

## 12. Show Compliance Intelligence

1. Open **Dashboard**.
2. Review the **Compliance Intelligence** panel.
3. Call out risk score, trend, highest-risk stage, most common exception, and top 5 risks.

Point to make: the system turns operational events into a risk picture for owners, FBR, and government stakeholders.

## 13. Login As FBR Officer

1. Switch to **FBR Officer**.
2. Open **Red Flags**.
3. Filter by Critical or High severity.
4. Mark an exception as **IN_REVIEW** with a reason.

Point to make: FBR can review compliance evidence but cannot change mill production, warehouse, dispatch, or buyer receipt data.

## 14. Login As Auditor

1. Switch to **Auditor**.
2. Open **Audit Logs** and show event hashes.
3. Open **Red Flags**.
4. Resolve or dismiss an exception with a reason.

Point to make: auditors can close evidence packets, but every decision is written to the audit hash chain.

## Closing Message

MillTrace PK detects the common control failures a sugar mill traceability system must handle:

- invalid or reused cane intake tickets
- unrealistic production recovery
- serial gaps or duplicate serials
- warehouse leakage
- dispatch without valid custody or invoice evidence
- buyer receipt shortage or fraud
- manual overrides without accountability

The MVP is intentionally simple, but the control model is real: role restrictions, service-layer validation, grouped exceptions, audit hash chaining, and a compliance risk score.
