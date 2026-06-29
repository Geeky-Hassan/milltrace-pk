from enum import StrEnum


class SerialStatus(StrEnum):
    ISSUED = "ISSUED"
    ACTIVATED = "ACTIVATED"
    WAREHOUSED = "WAREHOUSED"
    DISPATCHED = "DISPATCHED"
    RECEIVED = "RECEIVED"
    VOIDED = "VOIDED"


SERIAL_FORWARD_TRANSITIONS = {
    SerialStatus.ISSUED: SerialStatus.ACTIVATED,
    SerialStatus.ACTIVATED: SerialStatus.WAREHOUSED,
    SerialStatus.WAREHOUSED: SerialStatus.DISPATCHED,
    SerialStatus.DISPATCHED: SerialStatus.RECEIVED,
}


class ExceptionType(StrEnum):
    WEIGHT_INVALID = "WEIGHT_INVALID"
    RECOVERY_VARIANCE_WARNING = "RECOVERY_VARIANCE_WARNING"
    RECOVERY_VARIANCE_CRITICAL = "RECOVERY_VARIANCE_CRITICAL"
    SERIAL_DUPLICATE = "SERIAL_DUPLICATE"
    SERIAL_GAP = "SERIAL_GAP"
    SERIAL_INVALID_TRANSITION = "SERIAL_INVALID_TRANSITION"
    SERIAL_OUT_OF_ORDER = "SERIAL_OUT_OF_ORDER"
    ACTIVATED_NOT_WAREHOUSED = "ACTIVATED_NOT_WAREHOUSED"
    DISPATCH_WITHOUT_INVOICE = "DISPATCH_WITHOUT_INVOICE"
    DISPATCH_QUANTITY_MISMATCH = "DISPATCH_QUANTITY_MISMATCH"
    DISPATCH_INVALID_SERIAL = "DISPATCH_INVALID_SERIAL"
    RECEIPT_SHORTAGE = "RECEIPT_SHORTAGE"
    RECEIPT_EXTRA_SERIAL = "RECEIPT_EXTRA_SERIAL"
    RECEIPT_WRONG_BUYER = "RECEIPT_WRONG_BUYER"
    RECEIPT_MISSING = "RECEIPT_MISSING"
    MANUAL_OVERRIDE = "MANUAL_OVERRIDE"
    SERIAL_BELONGS_TO_ANOTHER_MILL = "SERIAL_BELONGS_TO_ANOTHER_MILL"


class ExceptionStatus(StrEnum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


EXCEPTION_DEFINITIONS = {
    ExceptionType.WEIGHT_INVALID: ("HIGH", "Invalid weighbridge values", "Reject intake and request weighbridge supervisor review."),
    ExceptionType.RECOVERY_VARIANCE_WARNING: ("MEDIUM", "Production recovery variance warning", "Review cane quality and production calibration evidence."),
    ExceptionType.RECOVERY_VARIANCE_CRITICAL: ("CRITICAL", "Critical production recovery variance", "Freeze batch and require mill owner or compliance approval."),
    ExceptionType.SERIAL_DUPLICATE: ("CRITICAL", "Duplicate serial detected", "Freeze serial and reconcile packaging line event history."),
    ExceptionType.SERIAL_GAP: ("HIGH", "Serial sequence gap detected", "Review serial generation range and missing sequence approvals."),
    ExceptionType.SERIAL_INVALID_TRANSITION: ("HIGH", "Invalid serial lifecycle movement", "Reject movement and investigate custody event ordering."),
    ExceptionType.SERIAL_OUT_OF_ORDER: ("MEDIUM", "Out-of-order serial activation", "Review packaging line activation sequence before dispatch."),
    ExceptionType.ACTIVATED_NOT_WAREHOUSED: ("MEDIUM", "Activated serial not warehoused", "Locate activated stock and complete warehouse receipt."),
    ExceptionType.DISPATCH_WITHOUT_INVOICE: ("HIGH", "Dispatch without invoice", "Hold dispatch clearance until invoice evidence is attached."),
    ExceptionType.DISPATCH_QUANTITY_MISMATCH: ("HIGH", "Dispatch quantity mismatch", "Reconcile invoice quantity with serialized bag count."),
    ExceptionType.DISPATCH_INVALID_SERIAL: ("CRITICAL", "Invalid serial in dispatch", "Block dispatch and reconcile warehouse custody."),
    ExceptionType.RECEIPT_SHORTAGE: ("HIGH", "Buyer receipt shortage", "Open buyer claim workflow and reconcile dispatched serials."),
    ExceptionType.RECEIPT_EXTRA_SERIAL: ("HIGH", "Unexpected serial in buyer receipt", "Investigate diversion risk and buyer receiving evidence."),
    ExceptionType.RECEIPT_WRONG_BUYER: ("CRITICAL", "Receipt buyer mismatch", "Reject receipt and verify dispatch buyer identity."),
    ExceptionType.RECEIPT_MISSING: ("MEDIUM", "Buyer receipt missing", "Notify buyer and require receipt confirmation evidence."),
    ExceptionType.MANUAL_OVERRIDE: ("HIGH", "Manual override", "Require supervisor approval and preserve audit evidence."),
    ExceptionType.SERIAL_BELONGS_TO_ANOTHER_MILL: ("CRITICAL", "Cross-mill serial fraud", "Block movement and verify serial ownership with the issuing mill."),
}


class DomainError(ValueError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def normalize_serial_status(status: str) -> SerialStatus:
    value = status.upper().replace(" ", "_")
    try:
        return SerialStatus(value)
    except ValueError as exc:
        raise DomainError(f"Unsupported serial status: {status}") from exc
