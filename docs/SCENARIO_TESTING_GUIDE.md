# Scenario Testing Guide

Use Scenario Lab to prove how MillTrace PK behaves from best case to worst case. Each run creates a result with exceptions, audit count, risk impact, and pass/partial status.

## 1. Fully Compliant Flow

Gap tested: clean end-to-end accountability.

Steps:
- create valid cane intake
- create normal production batch
- generate and activate serials
- warehouse serials
- dispatch with invoice
- receive by correct buyer

Expected result: no new critical exception, full audit trail, low risk impact.

Stakeholder should notice: the system can track a clean batch without creating noise.

## 2. Minor Recovery Variance

Gap tested: normal production variation.

Expected result: no critical exception.

Stakeholder should notice: the system does not overreact to small recovery differences.

## 3. Warning Recovery Variance

Gap tested: possible production suppression.

Expected result: `RECOVERY_VARIANCE_WARNING`, Medium severity.

Stakeholder should notice: suspicious output is flagged for review before being treated as fraud.

## 4. Critical Recovery Variance

Gap tested: suppressed or unreported production.

Expected result: `RECOVERY_VARIANCE_CRITICAL`, Critical severity.

Stakeholder should notice: far-below-expected output raises dashboard risk.

## 5. Serial Gap Detected

Gap tested: skipped serials or tax stamp misuse.

Expected result: `SERIAL_GAP`, High severity.

Stakeholder should notice: missing sequence numbers become visible immediately.

## 6. Duplicate Serial Used

Gap tested: copied/fake serial identity.

Expected result: `SERIAL_DUPLICATE`, Critical severity.

Stakeholder should notice: duplicate serial creation is blocked.

## 7. Dispatch Without Warehouse Receipt

Gap tested: bypassing warehouse accountability.

Expected result: `DISPATCH_INVALID_SERIAL`, dispatch blocked.

Stakeholder should notice: product cannot leave before warehouse custody.

## 8. Dispatch Without Invoice

Gap tested: off-book dispatch or fake documentation.

Expected result: `DISPATCH_WITHOUT_INVOICE`.

Stakeholder should notice: missing invoice evidence remains visible as a compliance issue.

## 9. Wrong Buyer Receipt

Gap tested: fake buyer receipt.

Expected result: `RECEIPT_WRONG_BUYER`, receipt rejected.

Stakeholder should notice: the dispatch buyer and receipt buyer must match.

## 10. Buyer Receipt Shortage

Gap tested: transport shortage or diversion.

Expected result: `RECEIPT_SHORTAGE`.

Stakeholder should notice: missing serials are not silently accepted.

## 11. Extra Serial In Buyer Receipt

Gap tested: product mixing, fake stock, or wrong shipment.

Expected result: `RECEIPT_EXTRA_SERIAL`.

Stakeholder should notice: unexpected serials are identified.

## 12. Manual Override Abuse

Gap tested: insider manipulation.

Expected result: `MANUAL_OVERRIDE`, action blocked.

Stakeholder should notice: sensitive changes need reason and audit evidence.

## 13. Cross-Mill Serial Fraud

Gap tested: serial reuse across mills.

Expected result: `SERIAL_BELONGS_TO_ANOTHER_MILL`.

Stakeholder should notice: serial ownership must be verified before custody changes.

## 14. Activated Serials Not Warehoused In Time

Gap tested: leakage between packaging and warehouse.

Expected result: `ACTIVATED_NOT_WAREHOUSED`.

Stakeholder should notice: the 24-hour custody gap becomes a risk.

## 15. Complete Fraud Chain

Gap tested: combined weak signals.

Expected result:
- `RECOVERY_VARIANCE_CRITICAL`
- `SERIAL_GAP`
- `ACTIVATED_NOT_WAREHOUSED`
- `DISPATCH_WITHOUT_INVOICE`
- `RECEIPT_MISSING`

Stakeholder should notice: MillTrace PK connects separate issues into a critical risk picture.
