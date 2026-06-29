import type {
  BuyerReceipt,
  CaneIntake,
  DashboardSummary,
  DemoUser,
  DispatchRecord,
  ExceptionAlert,
  PackagingSerial,
  ProductionBatch,
  WarehouseReceipt,
} from "@/types";

export const demoMill = {
  id: 1,
  name: "Mehrab Sugar Mills",
  province: "Punjab",
  district: "Rahim Yar Khan",
  license_number: "PSMA-RYK-042",
  ntn: "7394821-6",
};

export const dashboardSummary: DashboardSummary = {
  mill: demoMill,
  role: "mill_owner",
  metrics: [
    { label: "Total cane received today", value: "60.2 tons", delta: "+8.4% vs yesterday", tone: "success" },
    { label: "Estimated sugar output", value: "18.9 tons", delta: "Based on recovery model", tone: "neutral" },
    { label: "Actual packaged sugar", value: "17.8 tons", delta: "14.5 tons serialized", tone: "success" },
    { label: "Recovery variance", value: "-1,145 kg", delta: "1 critical batch", tone: "warning" },
    { label: "Active serials", value: "4", delta: "1 voided serial held", tone: "neutral" },
    { label: "Warehouse stock", value: "14.5 tons", delta: "3 active bays", tone: "success" },
    { label: "Dispatches today", value: "2", delta: "1 awaiting buyer receipt", tone: "neutral" },
    { label: "Red flag exceptions", value: "4", delta: "High/Critical open items", tone: "danger" },
  ],
  flow: {
    cane_intake: 60.2,
    production: 17.8,
    packaging: 14.5,
    warehouse: 14.5,
    dispatch: 5.9,
  },
  recovery_trend: [
    { shift: "Morning", expected: 11, actual: 10.88 },
    { shift: "Evening", expected: 11, actual: 10.31 },
    { shift: "Night", expected: 11, actual: 9.71 },
  ],
  exception_breakdown: {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 1,
  },
};

export const caneIntakes: CaneIntake[] = [
  {
    id: 3,
    delivery_id: "CI-2026-0003",
    farmer_supplier_name: "Chaudhry Cane Supply",
    vehicle_number: "MNA-2094",
    gross_weight_kg: 26800,
    tare_weight_kg: 8400,
    net_cane_weight_kg: 18400,
    collection_point: "Liaquatpur CP-4",
    mill_gate_timestamp: "2026-06-29T13:20:00Z",
    operator_name: "Bilal Ahmed",
    status: "Under Review",
  },
  {
    id: 2,
    delivery_id: "CI-2026-0002",
    farmer_supplier_name: "Al-Rehman Growers",
    vehicle_number: "RYK-7721",
    gross_weight_kg: 31200,
    tare_weight_kg: 9200,
    net_cane_weight_kg: 22000,
    collection_point: "Sadiqabad CP-2",
    mill_gate_timestamp: "2026-06-29T11:15:00Z",
    operator_name: "Bilal Ahmed",
    status: "Accepted",
  },
  {
    id: 1,
    delivery_id: "CI-2026-0001",
    farmer_supplier_name: "Haji Iqbal Farms",
    vehicle_number: "RNH-1847",
    gross_weight_kg: 28500,
    tare_weight_kg: 8750,
    net_cane_weight_kg: 19750,
    collection_point: "Kot Samaba CP-1",
    mill_gate_timestamp: "2026-06-29T10:35:00Z",
    operator_name: "Bilal Ahmed",
    status: "Accepted",
  },
];

export const productionBatches: ProductionBatch[] = [
  {
    id: 3,
    batch_id: "BATCH-2026-N01",
    shift: "Night",
    cane_input_weight_kg: 51600,
    expected_sugar_output_kg: 5676,
    actual_sugar_output_kg: 5010,
    recovery_percentage: 9.71,
    variance_status: "Critical",
  },
  {
    id: 2,
    batch_id: "BATCH-2026-A02",
    shift: "Evening",
    cane_input_weight_kg: 58400,
    expected_sugar_output_kg: 6424,
    actual_sugar_output_kg: 6020,
    recovery_percentage: 10.31,
    variance_status: "Warning",
  },
  {
    id: 1,
    batch_id: "BATCH-2026-A01",
    shift: "Morning",
    cane_input_weight_kg: 62000,
    expected_sugar_output_kg: 6820,
    actual_sugar_output_kg: 6745,
    recovery_percentage: 10.88,
    variance_status: "Normal",
  },
];

export const packagingSerials: PackagingSerial[] = [
  { id: 5, serial_number: "MPK-N01-000201", batch_id: "BATCH-2026-N01", bag_weight_kg: 50, packaging_line: "Line C", status: "Voided", timestamp: "2026-06-29T13:55:00Z" },
  { id: 4, serial_number: "MPK-A02-000101", batch_id: "BATCH-2026-A02", bag_weight_kg: 50, packaging_line: "Line B", status: "Activated", timestamp: "2026-06-29T13:35:00Z" },
  { id: 3, serial_number: "MPK-A01-000003", batch_id: "BATCH-2026-A01", bag_weight_kg: 50, packaging_line: "Line A", status: "Dispatched", timestamp: "2026-06-29T12:55:00Z" },
  { id: 2, serial_number: "MPK-A01-000002", batch_id: "BATCH-2026-A01", bag_weight_kg: 50, packaging_line: "Line A", status: "Warehoused", timestamp: "2026-06-29T12:45:00Z" },
  { id: 1, serial_number: "MPK-A01-000001", batch_id: "BATCH-2026-A01", bag_weight_kg: 50, packaging_line: "Line A", status: "Warehoused", timestamp: "2026-06-29T12:40:00Z" },
];

export const warehouseReceipts: WarehouseReceipt[] = [
  { id: 3, serial_range: "MPK-N01-000201 - MPK-N01-000260", batch_id: "BATCH-2026-N01", quantity: 60, total_weight_kg: 3000, warehouse_location: "WH-C / Hold", stock_age_days: 0, status: "Blocked", received_at: "2026-06-29T14:00:00Z" },
  { id: 2, serial_range: "MPK-A02-000101 - MPK-A02-000210", batch_id: "BATCH-2026-A02", quantity: 110, total_weight_kg: 5500, warehouse_location: "WH-B / Bay 01", stock_age_days: 0, status: "Pending QA", received_at: "2026-06-29T13:40:00Z" },
  { id: 1, serial_range: "MPK-A01-000001 - MPK-A01-000120", batch_id: "BATCH-2026-A01", quantity: 120, total_weight_kg: 6000, warehouse_location: "WH-A / Bay 03", stock_age_days: 1, status: "In Stock", received_at: "2026-06-29T12:50:00Z" },
];

export const dispatches: DispatchRecord[] = [
  { id: 2, dispatch_id: "DSP-2026-0002", buyer: "Karachi Trading Co.", vehicle_number: "KHI-9014", driver_name: "Rashid Ali", invoice_number: "INV-2026-9082", serial_range: "MPK-A01-000083 - MPK-A01-000120", quantity: 38, dispatch_status: "Delivered", dispatched_at: "2026-06-28T16:15:00Z" },
  { id: 1, dispatch_id: "DSP-2026-0001", buyer: "Lahore Wholesale Foods", vehicle_number: "LES-4412", driver_name: "Imran Shah", invoice_number: "INV-2026-9081", serial_range: "MPK-A01-000003 - MPK-A01-000082", quantity: 80, dispatch_status: "In Transit", dispatched_at: "2026-06-29T13:25:00Z" },
];

export const buyerReceipts: BuyerReceipt[] = [
  { id: 2, dispatch_id: "DSP-2026-0001", buyer_name: "Lahore Wholesale Foods", received_quantity: 0, shortage_mismatch: "Receipt pending", receipt_timestamp: "2026-06-29T14:20:00Z", status: "Pending" },
  { id: 1, dispatch_id: "DSP-2026-0002", buyer_name: "Karachi Trading Co.", received_quantity: 38, shortage_mismatch: "None", receipt_timestamp: "2026-06-29T06:40:00Z", status: "Confirmed" },
];

export const exceptions: ExceptionAlert[] = [
  { id: 7, alert_type: "Manual override", severity: "High", related_entity: "WH-C / Hold", description: "Warehouse block status was changed manually outside shift approval policy.", suggested_action: "Review audit trail and confirm approver authority.", status: "Open", detected_at: "2026-06-29T14:32:00Z" },
  { id: 6, alert_type: "Weighbridge mismatch", severity: "Medium", related_entity: "CI-2026-0003", description: "Manual tare entry differs from weighbridge sensor by 260 kg.", suggested_action: "Request operator review and supervisor sign-off.", status: "In Review", detected_at: "2026-06-29T13:45:00Z" },
  { id: 5, alert_type: "Buyer receipt missing", severity: "Low", related_entity: "DSP-2026-0001", description: "Buyer acknowledgement has not been received after dispatch window.", suggested_action: "Notify buyer and update receipt evidence.", status: "Open", detected_at: "2026-06-29T14:25:00Z" },
  { id: 4, alert_type: "Dispatch without warehouse receipt", severity: "High", related_entity: "DSP-2026-0001", description: "A subset of serials is attached to dispatch before complete warehouse confirmation.", suggested_action: "Hold invoice clearance until stock movement is reconciled.", status: "Open", detected_at: "2026-06-29T14:05:00Z" },
  { id: 3, alert_type: "Output variance", severity: "Medium", related_entity: "BATCH-2026-A02", description: "Actual output is 6.29% below expected recovery threshold.", suggested_action: "Review cane quality, bagasse moisture, and batch calibration.", status: "In Review", detected_at: "2026-06-29T13:20:00Z" },
  { id: 2, alert_type: "Duplicate serial", severity: "Critical", related_entity: "MPK-N01-000201", description: "Serial appeared in a void event and a warehouse hold receipt.", suggested_action: "Freeze serial range and require supervisor approval.", status: "Open", detected_at: "2026-06-29T13:55:00Z" },
  { id: 1, alert_type: "Serial gap", severity: "High", related_entity: "MPK-A01-000083", description: "Missing activation event between packaging and warehouse receipt.", suggested_action: "Reconcile packaging line A event logs before dispatch.", status: "Open", detected_at: "2026-06-29T13:38:00Z" },
];

export const demoUsers: DemoUser[] = [
  { id: 1, name: "Ayesha Khan", email: "owner@mehrab.example", status: "Active", role: { id: 1, code: "mill_owner", name: "Mill Owner", description: "Business owner with production, stock, and exception visibility." }, mill: demoMill },
  { id: 2, name: "Bilal Ahmed", email: "operator@mehrab.example", status: "Active", role: { id: 2, code: "mill_operator", name: "Mill Operator", description: "Creates cane intake and production batch records." }, mill: demoMill },
  { id: 3, name: "Sara Malik", email: "warehouse@mehrab.example", status: "Active", role: { id: 3, code: "warehouse_manager", name: "Warehouse Manager", description: "Manages stock receipts and dispatch movement." }, mill: demoMill },
  { id: 4, name: "Faisal Raza", email: "fbr@mehrab.example", status: "Active", role: { id: 4, code: "fbr_officer", name: "FBR Officer", description: "Views compliance dashboards and red flag exceptions." }, mill: demoMill },
  { id: 5, name: "Nadia Qureshi", email: "admin@gov.example", status: "Active", role: { id: 5, code: "government_admin", name: "Government Admin", description: "Views high-level mill compliance across the network." }, mill: null },
  { id: 6, name: "Omar Siddiqui", email: "auditor@mehrab.example", status: "Active", role: { id: 6, code: "auditor", name: "Auditor", description: "Reviews evidence logs and exception details." }, mill: demoMill },
];

export const serialLifecycle = ["Issued", "Activated", "Warehoused", "Dispatched", "Received"];

