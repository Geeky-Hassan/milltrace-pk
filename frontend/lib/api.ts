import {
  buyerReceipts,
  caneIntakes,
  dashboardSummary,
  demoUsers,
  dispatches,
  exceptions,
  packagingSerials,
  productionBatches,
  warehouseReceipts,
} from "@/lib/demo-data";
import { demoScenarios, gapMap, traceFallback } from "@/lib/demo-scenarios";
import type {
  BatchTrace,
  BuyerReceipt,
  CaneIntake,
  DashboardSummary,
  DemoUser,
  DispatchRecord,
  ExceptionAlert,
  PackagingSerial,
  ProductionBatch,
  RoleCode,
  WarehouseReceipt,
  AuditLog,
  ComplianceSettings,
  DemoScenario,
  DemoScenarioRun,
  GapMapItem,
} from "@/types";
import { getStoredToken } from "@/lib/use-demo-role";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

type RequestOptions = RequestInit & {
  fallbackOnError?: boolean;
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error?.message) {
      return error.message;
    }
  }
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    return typeof detail === "string" ? detail : JSON.stringify(detail);
  }
  return fallback;
}

async function request<T>(path: string, fallback: T, init?: RequestOptions): Promise<T> {
  try {
    const token = getStoredToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(getErrorMessage(payload, `API request failed: ${response.status}`));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (init?.fallbackOnError === false) {
      throw error;
    }
    return fallback;
  }
}

export function getDashboardSummary(role: RoleCode) {
  return request<DashboardSummary>(`/dashboard/summary?role=${role}`, { ...dashboardSummary, role });
}

export function getCaneIntakes() {
  return request<CaneIntake[]>("/cane-intakes", caneIntakes);
}

export function createCaneIntake(payload: Omit<CaneIntake, "id" | "delivery_id" | "net_cane_weight_kg" | "mill_gate_timestamp">) {
  const fallback: CaneIntake = {
    ...payload,
    id: Date.now(),
    delivery_id: "CI-2026-DEMO",
    net_cane_weight_kg: payload.gross_weight_kg - payload.tare_weight_kg,
    mill_gate_timestamp: new Date().toISOString(),
  };
  return request<CaneIntake>("/cane-intakes", fallback, {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackOnError: false,
  });
}

export function getProductionBatches() {
  return request<ProductionBatch[]>("/production-batches", productionBatches);
}

export function createProductionBatch(payload: {
  shift: string;
  cane_intake_ids?: number[];
  cane_input_weight_kg?: number;
  expected_sugar_output_kg?: number;
  actual_sugar_output_kg: number;
  downtime_explanation?: string | null;
}) {
  const caneInput = payload.cane_input_weight_kg ?? 60000;
  const expectedOutput = payload.expected_sugar_output_kg ?? caneInput * 0.105;
  const recovery = Number(((payload.actual_sugar_output_kg / caneInput) * 100).toFixed(2));
  const variance = Math.abs(expectedOutput - payload.actual_sugar_output_kg) / expectedOutput;
  const fallback: ProductionBatch = {
    ...payload,
    id: Date.now(),
    batch_id: "BATCH-2026-DEMO",
    cane_input_weight_kg: caneInput,
    expected_sugar_output_kg: expectedOutput,
    expected_recovery_percentage: 10.5,
    recovery_percentage: recovery,
    variance_kg: payload.actual_sugar_output_kg - expectedOutput,
    variance_percentage: Number((variance * 100).toFixed(2)),
    variance_status: variance >= 0.1 ? "Critical" : variance >= 0.05 ? "Warning" : "Normal",
  };
  return request<ProductionBatch>("/production-batches", fallback, {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackOnError: false,
  });
}

export function getPackagingSerials() {
  return request<PackagingSerial[]>("/packaging-serials", packagingSerials);
}

export function generatePackagingSerials(payload: {
  batch_id: string;
  quantity: number;
  bag_weight_kg: number;
  packaging_line: string;
  sku?: string;
  start_sequence?: number | null;
}) {
  return request<PackagingSerial[]>("/packaging-serials/generate", [], {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackOnError: false,
  });
}

export function getWarehouseReceipts() {
  return request<WarehouseReceipt[]>("/warehouse-receipts", warehouseReceipts);
}

export function createWarehouseReceipt(payload: {
  serial_numbers: string[];
  warehouse_location: string;
  sku?: string;
  quantity?: number;
  total_weight_kg?: number;
  status?: string;
}) {
  const fallback: WarehouseReceipt = {
    id: Date.now(),
    serial_numbers: payload.serial_numbers,
    serial_range: payload.serial_numbers.length > 0 ? `${payload.serial_numbers[0]} - ${payload.serial_numbers[payload.serial_numbers.length - 1]}` : "Manual receipt",
    batch_id: "BATCH-2026-DEMO",
    quantity: payload.quantity ?? payload.serial_numbers.length,
    total_weight_kg: payload.total_weight_kg ?? payload.serial_numbers.length * 50,
    warehouse_location: payload.warehouse_location,
    stock_age_days: 0,
    status: payload.status ?? "IN_STOCK",
    received_at: new Date().toISOString(),
  };
  return request<WarehouseReceipt>("/warehouse-receipts", fallback, {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackOnError: false,
  });
}

export function getDispatches() {
  return request<DispatchRecord[]>("/dispatches", dispatches);
}

export function createDispatchRecord(payload: {
  buyer: string;
  vehicle_number: string;
  driver_name: string;
  buyer_order_id?: string | null;
  invoice_number?: string | null;
  serial_numbers: string[];
  quantity: number;
}) {
  const fallback: DispatchRecord = {
    ...payload,
    id: Date.now(),
    dispatch_id: "DSP-2026-DEMO",
    invoice_number: payload.invoice_number ?? null,
    serial_range: payload.serial_numbers.length > 0 ? `${payload.serial_numbers[0]} - ${payload.serial_numbers[payload.serial_numbers.length - 1]}` : "Manual dispatch",
    dispatch_status: "IN_TRANSIT",
    dispatched_at: new Date().toISOString(),
  };
  return request<DispatchRecord>("/dispatches", fallback, {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackOnError: false,
  });
}

export function getBuyerReceipts() {
  return request<BuyerReceipt[]>("/buyer-receipts", buyerReceipts);
}

export function createBuyerReceipt(payload: {
  dispatch_id: string;
  buyer_name: string;
  receipt_location?: string | null;
  serial_numbers: string[];
  received_quantity?: number;
  shortage_mismatch?: string;
  status?: string;
}) {
  const fallback: BuyerReceipt = {
    ...payload,
    id: Date.now(),
    received_quantity: payload.received_quantity ?? payload.serial_numbers.length,
    shortage_mismatch: payload.shortage_mismatch ?? "None",
    status: payload.status ?? "CONFIRMED",
    receipt_timestamp: new Date().toISOString(),
  };
  return request<BuyerReceipt>("/buyer-receipts", fallback, {
    method: "POST",
    body: JSON.stringify(payload),
    fallbackOnError: false,
  });
}

export function getExceptions() {
  return request<ExceptionAlert[]>("/exceptions", exceptions);
}

export function getUsers() {
  return request<DemoUser[]>("/users", demoUsers);
}

export function getAuditLogs() {
  const fallback: AuditLog[] = [
    { id: 4, action: "REVIEW", entity: "ExceptionAlert", entity_id: "Duplicate serial", detail: "Auditor opened duplicate serial evidence packet.", created_at: "2026-06-29T14:10:00Z", actor_name: "Omar Siddiqui" },
    { id: 3, action: "UPDATE", entity: "WarehouseReceipt", entity_id: "WH-C / Hold", detail: "Manual block placed on suspect serial range.", created_at: "2026-06-29T13:55:00Z", actor_name: "Sara Malik" },
    { id: 2, action: "CREATE", entity: "ProductionBatch", entity_id: "BATCH-2026-A02", detail: "Evening shift production batch posted.", created_at: "2026-06-29T12:30:00Z", actor_name: "Bilal Ahmed" },
    { id: 1, action: "CREATE", entity: "CaneIntake", entity_id: "CI-2026-0001", detail: "Gate intake accepted with weighbridge evidence.", created_at: "2026-06-29T10:38:00Z", actor_name: "Bilal Ahmed" },
  ];
  return request<AuditLog[]>("/audit-logs", fallback);
}

export function getComplianceSettings() {
  return request<ComplianceSettings>("/settings/compliance", {
    expected_recovery_percentage: 10.5,
    activated_warehouse_limit_hours: 24,
    dispatch_receipt_limit_hours: 48,
    allowed_warehouse_locations: ["WH-A", "WH-B"],
    blockchain_anchor_hash: "future-integration",
  });
}

export function resolveException(id: number, status: "IN_REVIEW" | "RESOLVED" | "DISMISSED", reason?: string) {
  return request<ExceptionAlert>(
    `/exceptions/${id}/resolve`,
    exceptions.find((item) => item.id === id) ?? exceptions[0],
    {
      method: "PATCH",
      body: JSON.stringify({ status, reason }),
      fallbackOnError: false,
    },
  );
}

export function transitionSerial(
  serialNumber: string,
  payload: { target_status: string; reason?: string; supervisor_user_id?: number },
) {
  return request<PackagingSerial>(
    `/packaging-serials/${encodeURIComponent(serialNumber)}/transition`,
    packagingSerials.find((item) => item.serial_number === serialNumber) ?? packagingSerials[0],
    {
      method: "POST",
      body: JSON.stringify(payload),
      fallbackOnError: false,
    },
  );
}

export function getDemoScenarios() {
  return request<DemoScenario[]>("/demo/scenarios", demoScenarios);
}

export function runDemoScenario(scenarioId: string) {
  const scenario = demoScenarios.find((item) => item.id === scenarioId) ?? demoScenarios[0];
  const fallback: DemoScenarioRun = {
    id: Date.now(),
    scenario_id: scenario.id,
    scenario_name: scenario.name,
    scenario_type: scenario.scenario_type,
    status: "PARTIAL",
    description: "Scenario API unavailable; showing fallback result.",
    expected_exceptions: scenario.expected_exceptions,
    actual_exceptions: [],
    audit_logs_created: 0,
    risk_score_before: 0,
    risk_score_after: 0,
    created_at: new Date().toISOString(),
    created_by_role: "demo",
    what_happened: "Scenario API unavailable; showing fallback result.",
    gap_tested: scenario.gap_tested,
    expected_detection: scenario.expected_detection,
  };
  return request<DemoScenarioRun>(`/demo/scenarios/${scenarioId}/run`, fallback, {
    method: "POST",
    fallbackOnError: false,
  });
}

export function resetDemoData() {
  return request<{ status: string; message: string }>("/demo/reset", { status: "OK", message: "Demo data reset." }, {
    method: "POST",
    fallbackOnError: false,
  });
}

export function loadSeedData() {
  return request<{ status: string; message: string }>("/demo/seed", { status: "OK", message: "Seed data loaded." }, {
    method: "POST",
    fallbackOnError: false,
  });
}

export function clearSeedData() {
  return request<{ status: string; message: string }>("/demo/seed", { status: "OK", message: "Demo operational data cleared." }, {
    method: "DELETE",
    fallbackOnError: false,
  });
}

export function getScenarioResult(scenarioId: string) {
  return request<DemoScenarioRun | null>(`/demo/scenarios/${scenarioId}/result`, null);
}

export function getGapMap() {
  return request<GapMapItem[]>("/demo/gap-map", gapMap);
}

export function getBatchTrace(batchId: string) {
  return request<BatchTrace>(`/demo/trace/${encodeURIComponent(batchId)}`, { ...traceFallback, batch_id: batchId });
}

export function demoLogin(role: RoleCode) {
  const user = demoUsers.find((item) => item.role.code === role) ?? demoUsers[0];
  return request<{ token: string; user: DemoUser; permissions: string[] }>(
    "/auth/demo-login",
    { token: `demo-token-${role}`, user, permissions: [] },
    {
      method: "POST",
      body: JSON.stringify({ role }),
    },
  );
}
