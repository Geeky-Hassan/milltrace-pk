import pytest

from app.domain import ExceptionType
from app.models import DemoScenarioRun
from app.security import permission_for_request, role_has_permission
from app.services.demo_scenarios import DemoScenarioService


def test_clean_end_to_end_scenario_passes_and_creates_audit(db_session):
    result = DemoScenarioService(db_session).run("best-compliant-flow", "mill_owner")

    assert result.status == "PASSED"
    assert result.audit_logs_created > 0
    assert not result.expected_exceptions
    assert result.risk_score_after >= result.risk_score_before


@pytest.mark.parametrize(
    ("scenario_id", "expected_type"),
    [
        ("warning-recovery-variance", ExceptionType.RECOVERY_VARIANCE_WARNING.value),
        ("critical-recovery-variance", ExceptionType.RECOVERY_VARIANCE_CRITICAL.value),
        ("serial-gap-detected", ExceptionType.SERIAL_GAP.value),
        ("duplicate-serial-used", ExceptionType.SERIAL_DUPLICATE.value),
        ("dispatch-without-warehouse", ExceptionType.DISPATCH_INVALID_SERIAL.value),
        ("dispatch-without-invoice", ExceptionType.DISPATCH_WITHOUT_INVOICE.value),
        ("wrong-buyer-receipt", ExceptionType.RECEIPT_WRONG_BUYER.value),
        ("buyer-receipt-shortage", ExceptionType.RECEIPT_SHORTAGE.value),
        ("extra-serial-receipt", ExceptionType.RECEIPT_EXTRA_SERIAL.value),
        ("manual-override-abuse", ExceptionType.MANUAL_OVERRIDE.value),
        ("cross-mill-serial-fraud", ExceptionType.SERIAL_BELONGS_TO_ANOTHER_MILL.value),
        ("activated-not-warehoused", ExceptionType.ACTIVATED_NOT_WAREHOUSED.value),
    ],
)
def test_scenario_expected_exception_is_created(db_session, scenario_id, expected_type):
    result = DemoScenarioService(db_session).run(scenario_id, "mill_owner")

    assert result.status == "PASSED"
    assert expected_type in result.actual_exceptions
    assert result.audit_logs_created > 0


def test_complete_fraud_chain_creates_multiple_expected_exceptions(db_session):
    result = DemoScenarioService(db_session).run("complete-fraud-chain", "fbr_officer")

    assert result.status == "PASSED"
    assert ExceptionType.RECOVERY_VARIANCE_CRITICAL.value in result.actual_exceptions
    assert ExceptionType.SERIAL_GAP.value in result.actual_exceptions
    assert ExceptionType.ACTIVATED_NOT_WAREHOUSED.value in result.actual_exceptions
    assert ExceptionType.DISPATCH_WITHOUT_INVOICE.value in result.actual_exceptions
    assert ExceptionType.RECEIPT_MISSING.value in result.actual_exceptions
    assert result.risk_score_after >= result.risk_score_before


def test_normal_minor_variance_does_not_create_critical_exception(db_session):
    result = DemoScenarioService(db_session).run("normal-minor-variance", "mill_owner")

    assert result.status == "PASSED"
    assert ExceptionType.RECOVERY_VARIANCE_CRITICAL.value not in result.actual_exceptions


def test_unauthorized_role_cannot_perform_restricted_dispatch_action():
    permission = permission_for_request("POST", "/api/v1/dispatches")

    assert permission == "dispatch:create"
    assert not role_has_permission("mill_operator", permission)
    assert role_has_permission("warehouse_manager", permission)


def test_scenario_result_is_persisted_for_lab(db_session):
    service = DemoScenarioService(db_session)
    result = service.run("dispatch-without-invoice", "warehouse_manager")
    latest = service.latest_result("dispatch-without-invoice")

    assert latest is not None
    assert latest.id == result.id
    assert db_session.query(DemoScenarioRun).filter(DemoScenarioRun.scenario_id == "dispatch-without-invoice").count() == 1
