from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


RoleCode = Literal[
    "mill_owner",
    "mill_operator",
    "warehouse_manager",
    "fbr_officer",
    "government_admin",
    "auditor",
]


class RoleRead(BaseModel):
    id: int
    code: str
    name: str
    description: str

    model_config = ConfigDict(from_attributes=True)


class MillRead(BaseModel):
    id: int
    code: str
    name: str
    province: str
    district: str
    license_number: str
    ntn: str

    model_config = ConfigDict(from_attributes=True)


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    status: str
    role: RoleRead
    mill: MillRead | None = None

    model_config = ConfigDict(from_attributes=True)


class DemoLoginRequest(BaseModel):
    role: RoleCode


class DemoLoginResponse(BaseModel):
    token: str
    user: UserRead
    permissions: list[str]


class DashboardMetric(BaseModel):
    label: str
    value: str
    delta: str
    tone: str


class ComplianceRisk(BaseModel):
    type: str
    severity: str
    stage: str
    title: str
    suggested_action: str
    score_impact: int


class ComplianceIntelligence(BaseModel):
    risk_score: int
    risk_level: str
    risk_trend: str
    most_common_exception_type: str | None = None
    highest_risk_stage: str | None = None
    top_risks: list[ComplianceRisk]


class DashboardSummary(BaseModel):
    mill: MillRead
    role: str
    total_cane_received_today_kg: float
    total_cane_received_season_kg: float
    expected_sugar_output_kg: float
    actual_sugar_output_kg: float
    recovery_percentage: float
    recovery_variance_kg: float
    total_issued_serials: int
    total_activated_serials: int
    total_warehoused_serials: int
    total_dispatched_serials: int
    total_received_serials: int
    total_voided_serials: int
    open_exceptions_by_severity: dict[str, int]
    warehouse_stock_total_kg: float
    dispatches_pending_buyer_receipt: int
    compliance_intelligence: ComplianceIntelligence
    metrics: list[DashboardMetric]
    flow: dict[str, float]
    recovery_trend: list[dict[str, float | str]]
    exception_breakdown: dict[str, int]


class CaneIntakeBase(BaseModel):
    farmer_supplier_name: str = Field(min_length=2)
    vehicle_number: str = Field(min_length=2)
    cane_ticket_id: str | None = None
    gross_weight_kg: float = Field(gt=0)
    tare_weight_kg: float = Field(gt=0)
    collection_point: str
    operator_name: str
    operator_user_id: int | None = None
    manual_weight_override: bool = False
    override_reason: str | None = None
    status: str = "ACCEPTED"

    @field_validator("vehicle_number", "collection_point", "operator_name")
    @classmethod
    def not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Field cannot be blank")
        return stripped


class CaneIntakeCreate(CaneIntakeBase):
    pass


class CaneIntakeUpdate(BaseModel):
    farmer_supplier_name: str | None = None
    vehicle_number: str | None = None
    cane_ticket_id: str | None = None
    gross_weight_kg: float | None = Field(default=None, gt=0)
    tare_weight_kg: float | None = Field(default=None, gt=0)
    collection_point: str | None = None
    operator_name: str | None = None
    operator_user_id: int | None = None
    manual_weight_override: bool | None = None
    override_reason: str | None = None
    status: str | None = None


class CaneIntakeRead(CaneIntakeBase):
    id: int
    delivery_id: str
    net_cane_weight_kg: float
    mill_gate_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ProductionBatchBase(BaseModel):
    shift: str
    actual_sugar_output_kg: float = Field(gt=0)
    cane_input_weight_kg: float | None = Field(default=None, gt=0)
    expected_sugar_output_kg: float | None = Field(default=None, gt=0)
    expected_recovery_percentage: float | None = Field(default=None, gt=0)
    downtime_explanation: str | None = None


class ProductionBatchCreate(ProductionBatchBase):
    cane_intake_ids: list[int] = Field(default_factory=list)
    actor_user_id: int | None = None


class ProductionBatchUpdate(BaseModel):
    shift: str | None = None
    cane_input_weight_kg: float | None = Field(default=None, gt=0)
    expected_sugar_output_kg: float | None = Field(default=None, gt=0)
    actual_sugar_output_kg: float | None = Field(default=None, gt=0)
    variance_status: str | None = None
    downtime_explanation: str | None = None


class ProductionBatchRead(ProductionBatchBase):
    id: int
    batch_id: str
    cane_input_weight_kg: float
    expected_sugar_output_kg: float
    expected_recovery_percentage: float
    recovery_percentage: float
    variance_kg: float
    variance_percentage: float
    variance_status: str

    model_config = ConfigDict(from_attributes=True)


class PackagingSerialBase(BaseModel):
    batch_id: str
    bag_weight_kg: float = Field(gt=0)
    sku: str = "SUGAR_50KG"
    packaging_line: str
    status: str = "ISSUED"


class PackagingSerialCreate(PackagingSerialBase):
    serial_number: str
    sequence_number: int | None = Field(default=None, gt=0)
    actor_user_id: int | None = None


class SerialGenerateRequest(BaseModel):
    batch_id: str
    quantity: int | None = Field(default=None, gt=0)
    total_sugar_weight_kg: float | None = Field(default=None, gt=0)
    bag_weight_kg: float = Field(default=50, gt=0)
    packaging_line: str
    sku: str = "SUGAR_50KG"
    start_sequence: int | None = Field(default=None, gt=0)
    actor_user_id: int | None = None


class SerialTransitionRequest(BaseModel):
    target_status: str
    reason: str | None = None
    supervisor_user_id: int | None = None
    actor_user_id: int | None = None


class PackagingSerialUpdate(BaseModel):
    bag_weight_kg: float | None = Field(default=None, gt=0)
    packaging_line: str | None = None
    status: str | None = None


class PackagingSerialRead(PackagingSerialBase):
    id: int
    serial_number: str
    sequence_number: int
    timestamp: datetime
    status_updated_at: datetime
    warehouse_location: str | None = None
    void_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WarehouseReceiptBase(BaseModel):
    serial_numbers: list[str] = Field(default_factory=list)
    warehouse_location: str
    sku: str = "SUGAR_50KG"
    stock_age_days: int = 0
    status: str = "IN_STOCK"


class WarehouseReceiptCreate(WarehouseReceiptBase):
    batch_id: str | None = None
    actor_user_id: int | None = None
    serial_range: str | None = None
    quantity: int | None = Field(default=None, gt=0)
    total_weight_kg: float | None = Field(default=None, gt=0)


class WarehouseReceiptUpdate(BaseModel):
    quantity: int | None = Field(default=None, gt=0)
    total_weight_kg: float | None = Field(default=None, gt=0)
    warehouse_location: str | None = None
    stock_age_days: int | None = None
    status: str | None = None


class WarehouseReceiptRead(WarehouseReceiptBase):
    id: int
    serial_range: str
    batch_id: str
    quantity: int
    total_weight_kg: float
    received_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DispatchBase(BaseModel):
    buyer: str = Field(min_length=2)
    vehicle_number: str = Field(min_length=2)
    driver_name: str = Field(min_length=2)
    buyer_order_id: str | None = None
    invoice_number: str | None = None
    serial_numbers: list[str] = Field(default_factory=list)
    quantity: int = Field(gt=0)
    dispatch_status: str = "IN_TRANSIT"


class DispatchCreate(DispatchBase):
    actor_user_id: int | None = None
    serial_range: str | None = None

    @field_validator("invoice_number")
    @classmethod
    def clean_invoice(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("buyer", "vehicle_number", "driver_name")
    @classmethod
    def required_dispatch_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Dispatch buyer, vehicle number, and driver name are required")
        return stripped


class DispatchUpdate(BaseModel):
    buyer: str | None = None
    vehicle_number: str | None = None
    driver_name: str | None = None
    invoice_number: str | None = None
    serial_range: str | None = None
    quantity: int | None = Field(default=None, gt=0)
    dispatch_status: str | None = None


class DispatchRead(DispatchBase):
    id: int
    dispatch_id: str
    serial_range: str
    dispatched_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BuyerReceiptBase(BaseModel):
    dispatch_id: str
    buyer_name: str
    receipt_location: str | None = None
    serial_numbers: list[str] = Field(default_factory=list)
    received_quantity: int | None = Field(default=None, ge=0)
    shortage_mismatch: str = "None"
    status: str = "CONFIRMED"


class BuyerReceiptCreate(BuyerReceiptBase):
    actor_user_id: int | None = None


class BuyerReceiptUpdate(BaseModel):
    buyer_name: str | None = None
    received_quantity: int | None = Field(default=None, ge=0)
    shortage_mismatch: str | None = None
    status: str | None = None


class BuyerReceiptRead(BuyerReceiptBase):
    id: int
    received_quantity: int
    receipt_timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class ExceptionAlertRead(BaseModel):
    id: int
    type: str
    alert_type: str
    severity: str
    title: str
    related_entity_type: str
    related_entity_id: str
    related_entity: str
    description: str
    suggested_action: str
    status: str
    parent_exception_id: int | None = None
    occurrence_count: int
    resolution_reason: str | None = None
    detected_at: datetime
    created_at: datetime
    resolved_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ExceptionResolveRequest(BaseModel):
    actor_user_id: int | None = None
    status: str = "RESOLVED"
    reason: str | None = Field(default=None, min_length=4)


class AuditLogRead(BaseModel):
    id: int
    actor_user_id: int | None = None
    actor_role: str | None = None
    action: str
    entity_type: str
    entity: str
    entity_id: str
    old_value: str | None = None
    new_value: str | None = None
    detail: str
    previous_event_hash: str | None = None
    event_hash: str | None = None
    blockchain_anchor_hash: str | None = None
    created_at: datetime
    actor_name: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DemoScenarioRead(BaseModel):
    id: str
    name: str
    scenario_type: str
    difficulty: str
    description: str
    gap_tested: str
    expected_detection: str
    expected_exceptions: list[str]


class DemoScenarioRunRead(BaseModel):
    id: int
    scenario_id: str
    scenario_name: str
    scenario_type: str
    status: str
    description: str
    expected_exceptions: list[str]
    actual_exceptions: list[str]
    audit_logs_created: int
    risk_score_before: int
    risk_score_after: int
    created_at: datetime
    created_by_role: str
    what_happened: str
    gap_tested: str
    expected_detection: str


class GapMapItem(BaseModel):
    gap_name: str
    current_loophole: str
    system_control: str
    demo_scenario: str
    mvp_status: str
    future_integration_needed: str


class DemoResetResponse(BaseModel):
    status: str
    message: str


class TraceStep(BaseModel):
    stage: str
    status: str
    timestamp: datetime | None = None
    actor: str
    evidence: str
    related_exceptions: list[str]
    audit_hash: str | None = None


class BatchTraceRead(BaseModel):
    batch_id: str
    summary: str
    steps: list[TraceStep]
