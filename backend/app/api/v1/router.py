from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db
from app.db.seed import clear_demo_operational_data, load_demo_seed_data, reset_demo_database
from app.domain import DomainError, ExceptionStatus
from app.models import (
    BuyerReceipt,
    CaneIntake,
    Dispatch,
    ExceptionAlert,
    PackagingSerial,
    ProductionBatch,
    Role,
    WarehouseReceipt,
)
from app.repositories.core import (
    AuditRepository,
    BuyerReceiptRepository,
    CaneIntakeRepository,
    DispatchRepository,
    ExceptionRepository,
    MillRepository,
    ProductionBatchRepository,
    SerialRepository,
    UserRepository,
    WarehouseRepository,
)
from app.schemas import (
    AuditLogRead,
    BatchTraceRead,
    BuyerReceiptCreate,
    BuyerReceiptRead,
    BuyerReceiptUpdate,
    CaneIntakeCreate,
    CaneIntakeRead,
    CaneIntakeUpdate,
    DashboardSummary,
    DemoLoginRequest,
    DemoLoginResponse,
    DemoResetResponse,
    DemoScenarioRead,
    DemoScenarioRunRead,
    DispatchCreate,
    DispatchRead,
    DispatchUpdate,
    ExceptionAlertRead,
    ExceptionResolveRequest,
    GapMapItem,
    PackagingSerialCreate,
    PackagingSerialRead,
    PackagingSerialUpdate,
    ProductionBatchCreate,
    ProductionBatchRead,
    ProductionBatchUpdate,
    RoleRead,
    SerialGenerateRequest,
    SerialTransitionRequest,
    UserRead,
    WarehouseReceiptCreate,
    WarehouseReceiptRead,
    WarehouseReceiptUpdate,
)
from app.serializers import (
    audit_log_read,
    buyer_receipt_read,
    cane_intake_read,
    dispatch_read,
    packaging_serial_read,
    warehouse_receipt_read,
)
from app.security import ROLE_PERMISSIONS, create_demo_token
from app.services.buyer_receipt import BuyerReceiptService
from app.services.cane_intake import CaneIntakeService
from app.services.dashboard import DashboardService
from app.services.demo_scenarios import DemoScenarioService
from app.services.dispatch import DispatchService
from app.services.exceptions import ExceptionService
from app.services.production import ProductionService
from app.services.serials import SerialService
from app.services.warehouse import WarehouseService
from app.utils import utcnow

api_router = APIRouter()


def raise_http_error(error: DomainError) -> None:
    raise HTTPException(status_code=error.status_code, detail=str(error))


def table_view(
    rows: list[Any],
    *,
    search: str | None = None,
    status_filter: str | None = None,
    severity: str | None = None,
    role: str | None = None,
    action: str | None = None,
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
) -> list[Any]:
    filtered = rows
    if search:
        needle = search.lower()
        filtered = [row for row in filtered if needle in " ".join(str(value) for value in row.__dict__.values()).lower()]
    if status_filter:
        filtered = [
            row
            for row in filtered
            if getattr(row, "status", getattr(row, "dispatch_status", getattr(row, "variance_status", ""))).upper()
            == status_filter.upper()
        ]
    if severity:
        filtered = [row for row in filtered if getattr(row, "severity", "").upper() == severity.upper()]
    if role:
        filtered = [row for row in filtered if getattr(row, "actor_role", "") == role]
    if action:
        filtered = [row for row in filtered if getattr(row, "action", "") == action]
    reverse = sort_dir.lower() != "asc"
    filtered.sort(key=lambda row: getattr(row, sort_by, 0) or 0, reverse=reverse)
    return filtered[offset : offset + min(limit, 500)]


@api_router.get("/health")
def health_check():
    return {"status": "healthy", "time": utcnow().isoformat()}


@api_router.get("/auth/demo-roles", response_model=list[RoleRead])
def list_demo_roles(db: Session = Depends(get_db)):
    return db.query(Role).order_by(Role.id).all()


@api_router.post("/auth/demo-login", response_model=DemoLoginResponse)
def demo_login(payload: DemoLoginRequest, db: Session = Depends(get_db)):
    user = UserRepository(db).get_by_role_code(payload.role)
    if not user:
        raise HTTPException(status_code=404, detail="Demo user for role not found")
    return DemoLoginResponse(
        token=create_demo_token(user.id, user.role.code),
        user=user,
        permissions=sorted(ROLE_PERMISSIONS[payload.role]),
    )


@api_router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard_summary(role: str = Query("mill_owner"), db: Session = Depends(get_db)):
    try:
        return DashboardService(db).summary(role)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@api_router.get("/users", response_model=list[UserRead])
def list_users(db: Session = Depends(get_db)):
    return UserRepository(db).list()


@api_router.get("/mills")
def list_mills(db: Session = Depends(get_db)):
    mill = MillRepository(db).get_demo_mill()
    return [mill] if mill else []


@api_router.get("/settings/compliance")
def compliance_settings(db: Session = Depends(get_db)):
    mill = MillRepository(db).get_demo_mill()
    if not mill:
        raise HTTPException(status_code=404, detail="Demo mill not found")
    return {
        "expected_recovery_percentage": mill.expected_recovery_percentage,
        "activated_warehouse_limit_hours": mill.activated_warehouse_limit_hours,
        "dispatch_receipt_limit_hours": mill.dispatch_receipt_limit_hours,
        "allowed_warehouse_locations": [item.strip() for item in settings.allowed_warehouse_locations.split(",")],
        "blockchain_anchor_hash": "future-integration",
    }


@api_router.get("/demo/scenarios", response_model=list[DemoScenarioRead])
def list_demo_scenarios(db: Session = Depends(get_db)):
    return DemoScenarioService(db).list_scenarios()


@api_router.post("/demo/scenarios/{scenario_id}/run", response_model=DemoScenarioRunRead)
def run_demo_scenario(scenario_id: str, request: Request, db: Session = Depends(get_db)):
    try:
        return DemoScenarioService(db).run(scenario_id, request.state.role)
    except DomainError as error:
        raise_http_error(error)


@api_router.get("/demo/scenarios/{scenario_id}/result", response_model=DemoScenarioRunRead)
def get_demo_scenario_result(scenario_id: str, db: Session = Depends(get_db)):
    result = DemoScenarioService(db).latest_result(scenario_id)
    if not result:
        raise HTTPException(status_code=404, detail="Scenario has not been run yet")
    return result


@api_router.post("/demo/reset", response_model=DemoResetResponse)
def reset_demo_data(db: Session = Depends(get_db)):
    reset_demo_database(db)
    return DemoResetResponse(status="OK", message="Demo data reset to seeded state.")


@api_router.post("/demo/seed", response_model=DemoResetResponse)
def load_seed_demo_data(db: Session = Depends(get_db)):
    created = load_demo_seed_data(db, replace_existing=True)
    message = "Seed data loaded and operational demo records refreshed." if created else "Seed data already exists; no duplicate records were created."
    return DemoResetResponse(status="OK", message=message)


@api_router.delete("/demo/seed", response_model=DemoResetResponse)
def clear_seed_demo_data(db: Session = Depends(get_db)):
    deleted_count = clear_demo_operational_data(db)
    return DemoResetResponse(
        status="OK",
        message=f"Cleared {deleted_count} operational records across all roles and workflow pages. Roles, users, mill settings, and suppliers remain.",
    )


@api_router.get("/demo/gap-map", response_model=list[GapMapItem])
def get_gap_map(db: Session = Depends(get_db)):
    return DemoScenarioService(db).gap_map()


@api_router.get("/demo/trace/{batch_id}", response_model=BatchTraceRead)
def trace_batch(batch_id: str, db: Session = Depends(get_db)):
    try:
        return DemoScenarioService(db).trace_batch(batch_id)
    except DomainError as error:
        raise_http_error(error)


@api_router.get("/cane-intakes", response_model=list[CaneIntakeRead])
def list_cane_intakes(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = table_view(CaneIntakeRepository(db).list(), search=search, status_filter=status_filter, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)
    return [cane_intake_read(row) for row in rows]


@api_router.post("/cane-intakes", response_model=CaneIntakeRead, status_code=status.HTTP_201_CREATED)
def create_cane_intake(payload: CaneIntakeCreate, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"operator_user_id": request.state.user_id})
        return cane_intake_read(CaneIntakeService(db).create(payload))
    except DomainError as error:
        raise_http_error(error)


@api_router.get("/cane-intakes/{item_id}", response_model=CaneIntakeRead)
def get_cane_intake(item_id: int, db: Session = Depends(get_db)):
    item = CaneIntakeRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cane intake not found")
    return cane_intake_read(item)


@api_router.patch("/cane-intakes/{item_id}", response_model=CaneIntakeRead)
def update_cane_intake(item_id: int, payload: CaneIntakeUpdate, db: Session = Depends(get_db)):
    item = CaneIntakeRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cane intake not found")
    data = payload.model_dump(exclude_unset=True)
    if "gross_weight_kg" in data or "tare_weight_kg" in data:
        gross = data.get("gross_weight_kg", item.gross_weight_kg)
        tare = data.get("tare_weight_kg", item.tare_weight_kg)
        if gross <= tare:
            raise HTTPException(status_code=400, detail="Gross weight must be greater than tare weight")
        item.net_cane_weight_kg = gross - tare
    for key, value in data.items():
        if key != "farmer_supplier_name" and hasattr(item, key):
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return cane_intake_read(item)


@api_router.delete("/cane-intakes/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cane_intake(item_id: int, db: Session = Depends(get_db)):
    item = db.get(CaneIntake, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Cane intake not found")
    db.delete(item)
    db.commit()


@api_router.get("/production-batches", response_model=list[ProductionBatchRead])
def list_production_batches(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return table_view(ProductionBatchRepository(db).list(), search=search, status_filter=status_filter, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)


@api_router.post("/production-batches", response_model=ProductionBatchRead, status_code=status.HTTP_201_CREATED)
def create_production_batch(payload: ProductionBatchCreate, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return ProductionService(db).create(payload)
    except DomainError as error:
        raise_http_error(error)


@api_router.get("/production-batches/{item_id}", response_model=ProductionBatchRead)
def get_production_batch(item_id: int, db: Session = Depends(get_db)):
    item = ProductionBatchRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Production batch not found")
    return item


@api_router.patch("/production-batches/{item_id}", response_model=ProductionBatchRead)
def update_production_batch(item_id: int, payload: ProductionBatchUpdate, db: Session = Depends(get_db)):
    item = ProductionBatchRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Production batch not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)
    if item.cane_input_weight_kg > 0:
        item.recovery_percentage = round(item.actual_sugar_output_kg / item.cane_input_weight_kg * 100, 2)
    db.commit()
    db.refresh(item)
    return item


@api_router.delete("/production-batches/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_production_batch(item_id: int, db: Session = Depends(get_db)):
    item = db.get(ProductionBatch, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Production batch not found")
    db.delete(item)
    db.commit()


@api_router.get("/packaging-serials", response_model=list[PackagingSerialRead])
def list_packaging_serials(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = table_view(SerialRepository(db).list(), search=search, status_filter=status_filter, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)
    return [packaging_serial_read(row) for row in rows]


@api_router.post("/packaging-serials/generate", response_model=list[PackagingSerialRead], status_code=status.HTTP_201_CREATED)
def generate_packaging_serials(payload: SerialGenerateRequest, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return [packaging_serial_read(row) for row in SerialService(db).generate(payload)]
    except DomainError as error:
        raise_http_error(error)


@api_router.post("/packaging-serials/{serial_number}/transition", response_model=PackagingSerialRead)
def transition_packaging_serial(serial_number: str, payload: SerialTransitionRequest, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return packaging_serial_read(SerialService(db).transition(serial_number, payload))
    except DomainError as error:
        raise_http_error(error)


@api_router.get("/packaging-serials/{item_id}", response_model=PackagingSerialRead)
def get_packaging_serial(item_id: int, db: Session = Depends(get_db)):
    item = SerialRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Packaging serial not found")
    return packaging_serial_read(item)


@api_router.post("/packaging-serials", response_model=PackagingSerialRead, status_code=status.HTTP_201_CREATED)
def create_packaging_serial(payload: PackagingSerialCreate, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return packaging_serial_read(SerialService(db).create_manual(payload))
    except DomainError as error:
        raise_http_error(error)


@api_router.patch("/packaging-serials/{item_id}", response_model=PackagingSerialRead)
def update_packaging_serial(item_id: int, payload: PackagingSerialUpdate, db: Session = Depends(get_db)):
    item = SerialRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Packaging serial not found")
    if payload.status:
        try:
            return packaging_serial_read(
                SerialService(db).transition(item.serial_number, SerialTransitionRequest(target_status=payload.status))
            )
        except DomainError as error:
            raise_http_error(error)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return packaging_serial_read(item)


@api_router.delete("/packaging-serials/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_packaging_serial(item_id: int, db: Session = Depends(get_db)):
    item = db.get(PackagingSerial, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Packaging serial not found")
    db.delete(item)
    db.commit()


@api_router.get("/warehouse-receipts", response_model=list[WarehouseReceiptRead])
def list_warehouse_receipts(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = table_view(WarehouseRepository(db).list(), search=search, status_filter=status_filter, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)
    return [warehouse_receipt_read(row) for row in rows]


@api_router.get("/warehouse-receipts/{item_id}", response_model=WarehouseReceiptRead)
def get_warehouse_receipt(item_id: int, db: Session = Depends(get_db)):
    item = WarehouseRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse receipt not found")
    return warehouse_receipt_read(item)


@api_router.post("/warehouse-receipts", response_model=WarehouseReceiptRead, status_code=status.HTTP_201_CREATED)
def create_warehouse_receipt(payload: WarehouseReceiptCreate, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return warehouse_receipt_read(WarehouseService(db).create_receipt(payload))
    except DomainError as error:
        raise_http_error(error)


@api_router.patch("/warehouse-receipts/{item_id}", response_model=WarehouseReceiptRead)
def update_warehouse_receipt(item_id: int, payload: WarehouseReceiptUpdate, db: Session = Depends(get_db)):
    item = WarehouseRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse receipt not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return warehouse_receipt_read(item)


@api_router.delete("/warehouse-receipts/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_warehouse_receipt(item_id: int, db: Session = Depends(get_db)):
    item = db.get(WarehouseReceipt, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Warehouse receipt not found")
    db.delete(item)
    db.commit()


@api_router.get("/dispatches", response_model=list[DispatchRead])
def list_dispatches(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = table_view(DispatchRepository(db).list(), search=search, status_filter=status_filter, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)
    return [dispatch_read(row) for row in rows]


@api_router.get("/dispatches/demo-invoice")
def preview_demo_invoice(db: Session = Depends(get_db)):
    return {
        "invoice_number": DispatchRepository(db).next_invoice_number(),
        "source": "demo",
        "note": "Demo invoice number generated inside MillTrace PK. Future production deployments can replace this with a digital invoicing platform.",
    }


@api_router.get("/dispatches/{item_id}", response_model=DispatchRead)
def get_dispatch(item_id: int, db: Session = Depends(get_db)):
    item = DispatchRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    return dispatch_read(item)


@api_router.post("/dispatches", response_model=DispatchRead, status_code=status.HTTP_201_CREATED)
def create_dispatch(payload: DispatchCreate, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return dispatch_read(DispatchService(db).create(payload))
    except DomainError as error:
        raise_http_error(error)


@api_router.patch("/dispatches/{item_id}", response_model=DispatchRead)
def update_dispatch(item_id: int, payload: DispatchUpdate, db: Session = Depends(get_db)):
    item = DispatchRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return dispatch_read(item)


@api_router.delete("/dispatches/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dispatch(item_id: int, db: Session = Depends(get_db)):
    item = db.get(Dispatch, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    db.delete(item)
    db.commit()


@api_router.get("/buyer-receipts", response_model=list[BuyerReceiptRead])
def list_buyer_receipts(
    search: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = table_view(BuyerReceiptRepository(db).list(), search=search, status_filter=status_filter, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)
    return [buyer_receipt_read(row) for row in rows]


@api_router.get("/buyer-receipts/{item_id}", response_model=BuyerReceiptRead)
def get_buyer_receipt(item_id: int, db: Session = Depends(get_db)):
    item = BuyerReceiptRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Buyer receipt not found")
    return buyer_receipt_read(item)


@api_router.post("/buyer-receipts", response_model=BuyerReceiptRead, status_code=status.HTTP_201_CREATED)
def create_buyer_receipt(payload: BuyerReceiptCreate, request: Request, db: Session = Depends(get_db)):
    try:
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        return buyer_receipt_read(BuyerReceiptService(db).create(payload))
    except DomainError as error:
        raise_http_error(error)


@api_router.patch("/buyer-receipts/{item_id}", response_model=BuyerReceiptRead)
def update_buyer_receipt(item_id: int, payload: BuyerReceiptUpdate, db: Session = Depends(get_db)):
    item = BuyerReceiptRepository(db).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Buyer receipt not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        if hasattr(item, key):
            setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return buyer_receipt_read(item)


@api_router.delete("/buyer-receipts/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_buyer_receipt(item_id: int, db: Session = Depends(get_db)):
    item = db.get(BuyerReceipt, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Buyer receipt not found")
    db.delete(item)
    db.commit()


@api_router.get("/exceptions", response_model=list[ExceptionAlertRead])
def list_exception_alerts(
    search: str | None = None,
    severity: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return table_view(ExceptionRepository(db).list(severity), search=search, status_filter=status_filter, severity=severity, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)


@api_router.patch("/exceptions/{item_id}/resolve", response_model=ExceptionAlertRead)
def resolve_exception(item_id: int, payload: ExceptionResolveRequest, request: Request, db: Session = Depends(get_db)):
    try:
        status_value = ExceptionStatus(payload.status.upper())
        if request.state.role == "fbr_officer" and status_value != ExceptionStatus.IN_REVIEW:
            raise HTTPException(status_code=403, detail="FBR Officer can only mark exceptions as IN_REVIEW.")
        if request.state.role == "auditor" and status_value not in {ExceptionStatus.RESOLVED, ExceptionStatus.DISMISSED}:
            raise HTTPException(status_code=403, detail="Auditor can only resolve or dismiss exceptions.")
        payload = payload.model_copy(update={"actor_user_id": request.state.user_id})
        alert = ExceptionService(db).resolve(item_id, payload.actor_user_id, status_value, payload.reason)
        db.commit()
        db.refresh(alert)
        return alert
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@api_router.get("/audit-logs", response_model=list[AuditLogRead])
def list_audit_logs(
    search: str | None = None,
    role: str | None = None,
    action: str | None = None,
    sort_by: str = "id",
    sort_dir: str = "desc",
    offset: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    rows = table_view(AuditRepository(db).list(), search=search, role=role, action=action, sort_by=sort_by, sort_dir=sort_dir, offset=offset, limit=limit)
    return [audit_log_read(row) for row in rows]
