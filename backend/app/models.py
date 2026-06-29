from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.utils import utcnow


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)

    users: Mapped[list["User"]] = relationship(back_populates="role")


class Mill(Base, TimestampMixin):
    __tablename__ = "mills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, default="MEHRAB")
    name: Mapped[str] = mapped_column(String(160), unique=True)
    province: Mapped[str] = mapped_column(String(80))
    district: Mapped[str] = mapped_column(String(80))
    license_number: Mapped[str] = mapped_column(String(80), unique=True)
    ntn: Mapped[str] = mapped_column(String(80), unique=True)
    expected_recovery_percentage: Mapped[float] = mapped_column(Float, default=10.5)
    activated_warehouse_limit_hours: Mapped[int] = mapped_column(Integer, default=24)
    dispatch_receipt_limit_hours: Mapped[int] = mapped_column(Integer, default=48)

    users: Mapped[list["User"]] = relationship(back_populates="mill")
    farmer_suppliers: Mapped[list["FarmerSupplier"]] = relationship(back_populates="mill")
    cane_intakes: Mapped[list["CaneIntake"]] = relationship(back_populates="mill")
    production_batches: Mapped[list["ProductionBatch"]] = relationship(back_populates="mill")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    role_id: Mapped[int] = mapped_column(ForeignKey("roles.id"))
    mill_id: Mapped[int] = mapped_column(ForeignKey("mills.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="Active")

    role: Mapped[Role] = relationship(back_populates="users")
    mill: Mapped[Mill] = relationship(back_populates="users")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="actor")


class FarmerSupplier(Base, TimestampMixin):
    __tablename__ = "farmer_suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mill_id: Mapped[int] = mapped_column(ForeignKey("mills.id"))
    name: Mapped[str] = mapped_column(String(140), index=True)
    cnic: Mapped[str] = mapped_column(String(20), nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=True)
    village: Mapped[str] = mapped_column(String(120), nullable=True)

    mill: Mapped[Mill] = relationship(back_populates="farmer_suppliers")
    cane_intakes: Mapped[list["CaneIntake"]] = relationship(back_populates="farmer_supplier")


class CaneIntake(Base, TimestampMixin):
    __tablename__ = "cane_intakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    delivery_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    cane_ticket_id: Mapped[str] = mapped_column(String(80), unique=True, nullable=True)
    mill_id: Mapped[int] = mapped_column(ForeignKey("mills.id"))
    farmer_supplier_id: Mapped[int] = mapped_column(ForeignKey("farmer_suppliers.id"))
    vehicle_number: Mapped[str] = mapped_column(String(40), index=True)
    gross_weight_kg: Mapped[float] = mapped_column(Float)
    tare_weight_kg: Mapped[float] = mapped_column(Float)
    net_cane_weight_kg: Mapped[float] = mapped_column(Float)
    collection_point: Mapped[str] = mapped_column(String(120))
    mill_gate_timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    operator_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    operator_name: Mapped[str] = mapped_column(String(120))
    manual_weight_override: Mapped[str] = mapped_column(String(10), default="NO")
    override_reason: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="Accepted")

    mill: Mapped[Mill] = relationship(back_populates="cane_intakes")
    farmer_supplier: Mapped[FarmerSupplier] = relationship(back_populates="cane_intakes")
    operator: Mapped[User] = relationship()
    batch_links: Mapped[list["ProductionBatchCaneIntake"]] = relationship(back_populates="cane_intake")


class ProductionBatch(Base, TimestampMixin):
    __tablename__ = "production_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    batch_id: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    mill_id: Mapped[int] = mapped_column(ForeignKey("mills.id"))
    shift: Mapped[str] = mapped_column(String(40))
    cane_input_weight_kg: Mapped[float] = mapped_column(Float)
    expected_sugar_output_kg: Mapped[float] = mapped_column(Float)
    actual_sugar_output_kg: Mapped[float] = mapped_column(Float)
    recovery_percentage: Mapped[float] = mapped_column(Float)
    expected_recovery_percentage: Mapped[float] = mapped_column(Float, default=10.5)
    variance_kg: Mapped[float] = mapped_column(Float, default=0)
    variance_percentage: Mapped[float] = mapped_column(Float, default=0)
    variance_status: Mapped[str] = mapped_column(String(40))
    downtime_explanation: Mapped[str] = mapped_column(Text, nullable=True)

    mill: Mapped[Mill] = relationship(back_populates="production_batches")
    cane_intake_links: Mapped[list["ProductionBatchCaneIntake"]] = relationship(back_populates="production_batch")
    packaging_serials: Mapped[list["PackagingSerial"]] = relationship(back_populates="production_batch")
    warehouse_receipts: Mapped[list["WarehouseReceipt"]] = relationship(back_populates="production_batch")


class ProductionBatchCaneIntake(Base):
    __tablename__ = "production_batch_cane_intakes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    production_batch_id: Mapped[int] = mapped_column(ForeignKey("production_batches.id"), index=True)
    cane_intake_id: Mapped[int] = mapped_column(ForeignKey("cane_intakes.id"), index=True)

    production_batch: Mapped[ProductionBatch] = relationship(back_populates="cane_intake_links")
    cane_intake: Mapped[CaneIntake] = relationship(back_populates="batch_links")


class PackagingSerial(Base, TimestampMixin):
    __tablename__ = "packaging_serials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    serial_number: Mapped[str] = mapped_column(String(140), unique=True, index=True)
    production_batch_id: Mapped[int] = mapped_column(ForeignKey("production_batches.id"))
    bag_weight_kg: Mapped[float] = mapped_column(Float)
    sku: Mapped[str] = mapped_column(String(80), default="SUGAR_50KG")
    packaging_line: Mapped[str] = mapped_column(String(80))
    sequence_number: Mapped[int] = mapped_column(Integer, index=True, default=1)
    status: Mapped[str] = mapped_column(String(40), default="ISSUED", index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    status_updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    warehouse_location: Mapped[str] = mapped_column(String(100), nullable=True)
    warehouse_receipt_id: Mapped[int] = mapped_column(ForeignKey("warehouse_receipts.id"), nullable=True)
    dispatch_record_id: Mapped[int] = mapped_column(ForeignKey("dispatches.id"), nullable=True)
    buyer_receipt_id: Mapped[int] = mapped_column(ForeignKey("buyer_receipts.id"), nullable=True)
    void_reason: Mapped[str] = mapped_column(Text, nullable=True)
    supervisor_approval_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)

    production_batch: Mapped[ProductionBatch] = relationship(back_populates="packaging_serials")
    warehouse_receipt: Mapped["WarehouseReceipt"] = relationship(back_populates="serials")
    dispatch: Mapped["Dispatch"] = relationship(back_populates="serials")
    buyer_receipt: Mapped["BuyerReceipt"] = relationship(back_populates="serials")
    supervisor_approval_user: Mapped[User] = relationship()


class WarehouseReceipt(Base, TimestampMixin):
    __tablename__ = "warehouse_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    serial_range: Mapped[str] = mapped_column(String(120), index=True)
    production_batch_id: Mapped[int] = mapped_column(ForeignKey("production_batches.id"))
    sku: Mapped[str] = mapped_column(String(80), default="SUGAR_50KG")
    quantity: Mapped[int] = mapped_column(Integer)
    total_weight_kg: Mapped[float] = mapped_column(Float)
    warehouse_location: Mapped[str] = mapped_column(String(100))
    stock_age_days: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(40), default="IN_STOCK")
    serial_numbers: Mapped[str] = mapped_column(Text, default="")
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    production_batch: Mapped[ProductionBatch] = relationship(back_populates="warehouse_receipts")
    serials: Mapped[list[PackagingSerial]] = relationship(back_populates="warehouse_receipt")


class Dispatch(Base, TimestampMixin):
    __tablename__ = "dispatches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dispatch_id: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    mill_id: Mapped[int] = mapped_column(ForeignKey("mills.id"), nullable=True)
    buyer_order_id: Mapped[str] = mapped_column(String(80), nullable=True)
    buyer: Mapped[str] = mapped_column(String(140), index=True)
    vehicle_number: Mapped[str] = mapped_column(String(40), index=True)
    driver_name: Mapped[str] = mapped_column(String(120))
    invoice_number: Mapped[str] = mapped_column(String(80), unique=True, nullable=True)
    serial_range: Mapped[str] = mapped_column(String(120))
    serial_numbers: Mapped[str] = mapped_column(Text, default="")
    quantity: Mapped[int] = mapped_column(Integer)
    dispatch_status: Mapped[str] = mapped_column(String(40), default="IN_TRANSIT")
    dispatched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    buyer_receipts: Mapped[list["BuyerReceipt"]] = relationship(back_populates="dispatch")
    serials: Mapped[list[PackagingSerial]] = relationship(back_populates="dispatch")


class BuyerReceipt(Base, TimestampMixin):
    __tablename__ = "buyer_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dispatch_record_id: Mapped[int] = mapped_column(ForeignKey("dispatches.id"))
    buyer_name: Mapped[str] = mapped_column(String(140))
    receipt_location: Mapped[str] = mapped_column(String(120), nullable=True)
    received_quantity: Mapped[int] = mapped_column(Integer)
    serial_numbers: Mapped[str] = mapped_column(Text, default="")
    shortage_mismatch: Mapped[str] = mapped_column(String(140), default="None")
    receipt_timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(String(40), default="CONFIRMED")

    dispatch: Mapped[Dispatch] = relationship(back_populates="buyer_receipts")
    serials: Mapped[list[PackagingSerial]] = relationship(back_populates="buyer_receipt")


class ExceptionAlert(Base, TimestampMixin):
    __tablename__ = "exception_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(80), index=True, default="")
    alert_type: Mapped[str] = mapped_column(String(80), index=True)
    severity: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(160), default="")
    related_entity_type: Mapped[str] = mapped_column(String(80), default="")
    related_entity_id: Mapped[str] = mapped_column(String(120), default="")
    related_entity: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    suggested_action: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="OPEN")
    parent_exception_id: Mapped[int] = mapped_column(ForeignKey("exception_alerts.id"), nullable=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, default=1)
    resolution_reason: Mapped[str] = mapped_column(Text, nullable=True)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    actor_role: Mapped[str] = mapped_column(String(80), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    entity_type: Mapped[str] = mapped_column(String(100), default="")
    entity: Mapped[str] = mapped_column(String(100))
    entity_id: Mapped[str] = mapped_column(String(80))
    old_value: Mapped[str] = mapped_column(Text, nullable=True)
    new_value: Mapped[str] = mapped_column(Text, nullable=True)
    detail: Mapped[str] = mapped_column(Text)
    previous_event_hash: Mapped[str] = mapped_column(String(128), nullable=True)
    event_hash: Mapped[str] = mapped_column(String(128), nullable=True, index=True)
    blockchain_anchor_hash: Mapped[str] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    actor: Mapped[User] = relationship(back_populates="audit_logs")


class DemoScenarioRun(Base):
    __tablename__ = "demo_scenario_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scenario_id: Mapped[str] = mapped_column(String(80), index=True)
    scenario_name: Mapped[str] = mapped_column(String(180))
    scenario_type: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(40), default="PARTIAL")
    description: Mapped[str] = mapped_column(Text)
    expected_exceptions: Mapped[str] = mapped_column(Text, default="")
    actual_exceptions: Mapped[str] = mapped_column(Text, default="")
    audit_logs_created: Mapped[int] = mapped_column(Integer, default=0)
    risk_score_before: Mapped[int] = mapped_column(Integer, default=0)
    risk_score_after: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_by_role: Mapped[str] = mapped_column(String(80), default="mill_owner")
