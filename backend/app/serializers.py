from app.models import AuditLog, BuyerReceipt, CaneIntake, Dispatch, PackagingSerial, WarehouseReceipt
from app.schemas import AuditLogRead, BuyerReceiptRead, CaneIntakeRead, DispatchRead, PackagingSerialRead, WarehouseReceiptRead
from app.utils import parse_csv


def cane_intake_read(item: CaneIntake) -> CaneIntakeRead:
    return CaneIntakeRead(
        id=item.id,
        delivery_id=item.delivery_id,
        farmer_supplier_name=item.farmer_supplier.name,
        vehicle_number=item.vehicle_number,
        cane_ticket_id=item.cane_ticket_id,
        gross_weight_kg=item.gross_weight_kg,
        tare_weight_kg=item.tare_weight_kg,
        net_cane_weight_kg=item.net_cane_weight_kg,
        collection_point=item.collection_point,
        mill_gate_timestamp=item.mill_gate_timestamp,
        operator_user_id=item.operator_user_id,
        operator_name=item.operator.name if item.operator else item.operator_name,
        manual_weight_override=item.manual_weight_override == "YES",
        override_reason=item.override_reason,
        status=item.status,
    )


def packaging_serial_read(item: PackagingSerial) -> PackagingSerialRead:
    return PackagingSerialRead(
        id=item.id,
        serial_number=item.serial_number,
        batch_id=item.production_batch.batch_id,
        bag_weight_kg=item.bag_weight_kg,
        sku=item.sku,
        packaging_line=item.packaging_line,
        sequence_number=item.sequence_number,
        status=item.status,
        timestamp=item.timestamp,
        status_updated_at=item.status_updated_at,
        warehouse_location=item.warehouse_location,
        void_reason=item.void_reason,
    )


def warehouse_receipt_read(item: WarehouseReceipt) -> WarehouseReceiptRead:
    return WarehouseReceiptRead(
        id=item.id,
        serial_numbers=parse_csv(item.serial_numbers),
        serial_range=item.serial_range,
        batch_id=item.production_batch.batch_id,
        sku=item.sku,
        quantity=item.quantity,
        total_weight_kg=item.total_weight_kg,
        warehouse_location=item.warehouse_location,
        stock_age_days=item.stock_age_days,
        status=item.status,
        received_at=item.received_at,
    )


def dispatch_read(item: Dispatch) -> DispatchRead:
    return DispatchRead(
        id=item.id,
        dispatch_id=item.dispatch_id,
        buyer=item.buyer,
        vehicle_number=item.vehicle_number,
        driver_name=item.driver_name,
        buyer_order_id=item.buyer_order_id,
        invoice_number=item.invoice_number,
        serial_numbers=parse_csv(item.serial_numbers),
        serial_range=item.serial_range,
        quantity=item.quantity,
        dispatch_status=item.dispatch_status,
        dispatched_at=item.dispatched_at,
    )


def buyer_receipt_read(item: BuyerReceipt) -> BuyerReceiptRead:
    return BuyerReceiptRead(
        id=item.id,
        dispatch_id=item.dispatch.dispatch_id,
        buyer_name=item.buyer_name,
        receipt_location=item.receipt_location,
        serial_numbers=parse_csv(item.serial_numbers),
        received_quantity=item.received_quantity,
        shortage_mismatch=item.shortage_mismatch,
        receipt_timestamp=item.receipt_timestamp,
        status=item.status,
    )


def audit_log_read(item: AuditLog) -> AuditLogRead:
    return AuditLogRead(
        id=item.id,
        actor_user_id=item.actor_user_id,
        actor_role=item.actor_role,
        action=item.action,
        entity_type=item.entity_type or item.entity,
        entity=item.entity,
        entity_id=item.entity_id,
        old_value=item.old_value,
        new_value=item.new_value,
        detail=item.detail,
        previous_event_hash=item.previous_event_hash,
        event_hash=item.event_hash,
        blockchain_anchor_hash=item.blockchain_anchor_hash,
        created_at=item.created_at,
        actor_name=item.actor.name if item.actor else None,
    )
