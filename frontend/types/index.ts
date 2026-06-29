export type RoleCode =
  | "mill_owner"
  | "mill_operator"
  | "warehouse_manager"
  | "fbr_officer"
  | "government_admin"
  | "auditor";

export type Tone = "success" | "warning" | "danger" | "neutral";

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  tone: Tone;
};

export type DashboardSummary = {
  mill: Mill;
  role: RoleCode | string;
  total_cane_received_today_kg?: number;
  total_cane_received_season_kg?: number;
  expected_sugar_output_kg?: number;
  actual_sugar_output_kg?: number;
  recovery_percentage?: number;
  recovery_variance_kg?: number;
  total_issued_serials?: number;
  total_activated_serials?: number;
  total_warehoused_serials?: number;
  total_dispatched_serials?: number;
  total_received_serials?: number;
  total_voided_serials?: number;
  open_exceptions_by_severity?: Record<string, number>;
  warehouse_stock_total_kg?: number;
  dispatches_pending_buyer_receipt?: number;
  compliance_intelligence?: ComplianceIntelligence;
  metrics: DashboardMetric[];
  flow: Record<"cane_intake" | "production" | "packaging" | "warehouse" | "dispatch", number>;
  recovery_trend: Array<{ shift: string; expected: number; actual: number }>;
  exception_breakdown: Record<string, number>;
};

export type Mill = {
  id: number;
  code?: string;
  name: string;
  province: string;
  district: string;
  license_number: string;
  ntn: string;
};

export type DemoUser = {
  id: number;
  name: string;
  email: string;
  status: string;
  role: {
    id: number;
    code: RoleCode;
    name: string;
    description: string;
  };
  mill?: Mill | null;
};

export type CaneIntake = {
  id: number;
  delivery_id: string;
  farmer_supplier_name: string;
  cane_ticket_id?: string | null;
  vehicle_number: string;
  gross_weight_kg: number;
  tare_weight_kg: number;
  net_cane_weight_kg: number;
  collection_point: string;
  mill_gate_timestamp: string;
  operator_name: string;
  operator_user_id?: number | null;
  manual_weight_override?: boolean;
  override_reason?: string | null;
  status: string;
};

export type ProductionBatch = {
  id: number;
  batch_id: string;
  shift: string;
  cane_input_weight_kg: number;
  expected_sugar_output_kg: number;
  actual_sugar_output_kg: number;
  expected_recovery_percentage?: number;
  recovery_percentage: number;
  variance_kg?: number;
  variance_percentage?: number;
  variance_status: "Normal" | "Warning" | "Critical" | string;
  downtime_explanation?: string | null;
};

export type PackagingSerial = {
  id: number;
  serial_number: string;
  batch_id: string;
  bag_weight_kg: number;
  sku?: string;
  packaging_line: string;
  status: "Issued" | "Activated" | "Warehoused" | "Dispatched" | "Received" | "Voided" | string;
  timestamp: string;
  sequence_number?: number;
  status_updated_at?: string;
  warehouse_location?: string | null;
  void_reason?: string | null;
};

export type WarehouseReceipt = {
  id: number;
  serial_range: string;
  serial_numbers?: string[];
  batch_id: string;
  quantity: number;
  total_weight_kg: number;
  warehouse_location: string;
  stock_age_days: number;
  status: string;
  received_at: string;
};

export type DispatchRecord = {
  id: number;
  dispatch_id: string;
  buyer: string;
  buyer_order_id?: string | null;
  vehicle_number: string;
  driver_name: string;
  invoice_number: string | null;
  serial_range: string;
  serial_numbers?: string[];
  quantity: number;
  dispatch_status: string;
  dispatched_at: string;
};

export type BuyerReceipt = {
  id: number;
  dispatch_id: string;
  buyer_name: string;
  receipt_location?: string | null;
  serial_numbers?: string[];
  received_quantity: number;
  shortage_mismatch: string;
  receipt_timestamp: string;
  status: string;
};

export type ExceptionAlert = {
  id: number;
  type?: string;
  alert_type: string;
  severity: "Low" | "Medium" | "High" | "Critical" | string;
  title?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  related_entity: string;
  description: string;
  suggested_action: string;
  status: string;
  occurrence_count?: number;
  resolution_reason?: string | null;
  detected_at: string;
  created_at?: string;
  resolved_at?: string | null;
};

export type AuditLog = {
  id: number;
  actor_user_id?: number | null;
  actor_role?: string | null;
  action: string;
  entity_type?: string;
  entity: string;
  entity_id: string;
  detail: string;
  old_value?: string | null;
  new_value?: string | null;
  previous_event_hash?: string | null;
  event_hash?: string | null;
  blockchain_anchor_hash?: string | null;
  created_at: string;
  actor_name?: string | null;
};

export type ComplianceRisk = {
  type: string;
  severity: string;
  stage: string;
  title: string;
  suggested_action: string;
  score_impact: number;
};

export type ComplianceIntelligence = {
  risk_score: number;
  risk_level: string;
  risk_trend: "improving" | "stable" | "worsening" | string;
  most_common_exception_type?: string | null;
  highest_risk_stage?: string | null;
  top_risks: ComplianceRisk[];
};

export type ComplianceSettings = {
  expected_recovery_percentage: number;
  activated_warehouse_limit_hours: number;
  dispatch_receipt_limit_hours: number;
  allowed_warehouse_locations: string[];
  blockchain_anchor_hash?: string;
};

export type DemoScenario = {
  id: string;
  name: string;
  scenario_type: string;
  difficulty: string;
  description: string;
  gap_tested: string;
  expected_detection: string;
  expected_exceptions: string[];
};

export type DemoScenarioRun = {
  id: number;
  scenario_id: string;
  scenario_name: string;
  scenario_type: string;
  status: "PASSED" | "FAILED" | "PARTIAL" | string;
  description: string;
  expected_exceptions: string[];
  actual_exceptions: string[];
  audit_logs_created: number;
  risk_score_before: number;
  risk_score_after: number;
  created_at: string;
  created_by_role: string;
  what_happened: string;
  gap_tested: string;
  expected_detection: string;
};

export type GapMapItem = {
  gap_name: string;
  current_loophole: string;
  system_control: string;
  demo_scenario: string;
  mvp_status: string;
  future_integration_needed: string;
};

export type TraceStep = {
  stage: string;
  status: string;
  timestamp?: string | null;
  actor: string;
  evidence: string;
  related_exceptions: string[];
  audit_hash?: string | null;
};

export type BatchTrace = {
  batch_id: string;
  summary: string;
  steps: TraceStep[];
};
