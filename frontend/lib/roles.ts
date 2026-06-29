import {
  AlertTriangle,
  BadgeCheck,
  Boxes,
  Building2,
  ClipboardCheck,
  Factory,
  FileWarning,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Map,
  PackageCheck,
  ReceiptText,
  Scale,
  ScrollText,
  Settings,
  TestTube2,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RoleCode } from "@/types";

export const roleLabels: Record<RoleCode, string> = {
  mill_owner: "Mill Owner",
  mill_operator: "Mill Operator",
  warehouse_manager: "Warehouse Manager",
  fbr_officer: "FBR Officer",
  government_admin: "Government Admin",
  auditor: "Auditor",
};

export const roleDescriptions: Record<RoleCode, string> = {
  mill_owner: "Business visibility across production, stock, dispatch, and exceptions.",
  mill_operator: "Creates cane intake and production evidence from mill operations.",
  warehouse_manager: "Controls warehouse receipts, stock movement, and dispatch status.",
  fbr_officer: "Reviews compliance summary and red flag exceptions.",
  government_admin: "Sees high-level compliance across the demo mill network.",
  auditor: "Reviews evidence logs, lifecycle detail, and exception packets.",
};

export const roleIcons: Record<RoleCode, LucideIcon> = {
  mill_owner: Building2,
  mill_operator: Factory,
  warehouse_manager: Boxes,
  fbr_officer: ShieldCheck,
  government_admin: UserCog,
  auditor: ClipboardCheck,
};

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: RoleCode[];
};

export const navItems: NavItem[] = [
  {
    href: "/scope",
    label: "Scope & Solution Map",
    icon: Map,
    roles: ["mill_owner", "mill_operator", "warehouse_manager", "fbr_officer", "government_admin", "auditor"],
  },
  {
    href: "/scenario-lab",
    label: "Scenario Lab",
    icon: TestTube2,
    roles: ["mill_owner", "mill_operator", "warehouse_manager", "fbr_officer", "government_admin", "auditor"],
  },
  {
    href: "/trace-batch",
    label: "Trace One Batch",
    icon: GitBranch,
    roles: ["mill_owner", "mill_operator", "warehouse_manager", "fbr_officer", "government_admin", "auditor"],
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["mill_owner", "mill_operator", "warehouse_manager", "fbr_officer", "government_admin", "auditor"],
  },
  {
    href: "/dashboard/cane-intake",
    label: "Cane Intake",
    icon: Scale,
    roles: ["mill_owner", "mill_operator"],
  },
  {
    href: "/dashboard/production",
    label: "Production",
    icon: Gauge,
    roles: ["mill_owner", "mill_operator", "government_admin"],
  },
  {
    href: "/dashboard/packaging",
    label: "Packaging & Serials",
    icon: PackageCheck,
    roles: ["mill_owner", "mill_operator", "fbr_officer", "government_admin", "auditor"],
  },
  {
    href: "/dashboard/warehouse",
    label: "Warehouse",
    icon: Boxes,
    roles: ["mill_owner", "warehouse_manager", "government_admin"],
  },
  {
    href: "/dashboard/dispatch",
    label: "Dispatch",
    icon: Truck,
    roles: ["mill_owner", "warehouse_manager", "government_admin"],
  },
  {
    href: "/dashboard/buyer-receipts",
    label: "Buyer Receipts",
    icon: ReceiptText,
    roles: ["warehouse_manager", "government_admin", "auditor"],
  },
  {
    href: "/dashboard/exceptions",
    label: "Red Flags",
    icon: FileWarning,
    roles: ["mill_owner", "mill_operator", "fbr_officer", "government_admin", "auditor"],
  },
  {
    href: "/dashboard/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    roles: ["mill_owner", "fbr_officer", "auditor"],
  },
  {
    href: "/dashboard/roles",
    label: "Roles",
    icon: Users,
    roles: ["government_admin", "auditor", "mill_owner"],
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["government_admin", "mill_owner"],
  },
];

export const roleCapabilities: Record<RoleCode, string[]> = {
  mill_owner: ["Read-only operations", "Production visibility", "Warehouse stock", "Dispatch oversight", "Exceptions"],
  mill_operator: ["Create cane intake", "Create batches", "Activate serials", "Production exceptions"],
  warehouse_manager: ["Warehouse receipt", "Dispatch management", "Buyer receipt tracking"],
  fbr_officer: ["Compliance dashboard", "All exceptions", "Audit logs", "Mark in review"],
  government_admin: ["High-level dashboard", "All mills", "Compliance status"],
  auditor: ["Evidence logs", "Exception review", "Resolve with reason"],
};

export const stakeholderLenses: Record<RoleCode, { title: string; icon: LucideIcon; detail: string }> = {
  mill_owner: {
    title: "Owner lens",
    icon: BadgeCheck,
    detail: "Production recovery, sellable stock, dispatch movement, and open red flags stay above the fold.",
  },
  mill_operator: {
    title: "Operator lens",
    icon: Factory,
    detail: "Daily intake and shift batch records are prioritized for fast operational entry.",
  },
  warehouse_manager: {
    title: "Warehouse lens",
    icon: Boxes,
    detail: "Serial custody, bay stock, dispatch release, and buyer acknowledgement are grouped together.",
  },
  fbr_officer: {
    title: "FBR lens",
    icon: AlertTriangle,
    detail: "The interface narrows to compliance metrics and exception evidence.",
  },
  government_admin: {
    title: "Government lens",
    icon: UserCog,
    detail: "The demo presents a network-ready view while using one seeded mill for the MVP.",
  },
  auditor: {
    title: "Audit lens",
    icon: ClipboardCheck,
    detail: "Serial lifecycle and exception details are available without write controls.",
  },
};

export function canAccess(role: RoleCode, href: string) {
  const item = navItems.find((navItem) => navItem.href === href);
  return item ? item.roles.includes(role) : false;
}

export function canCreateCaneIntake(role: RoleCode) {
  return role === "mill_operator" || role === "government_admin";
}

export function canCreateProduction(role: RoleCode) {
  return role === "mill_operator";
}

export function canManageWarehouse(role: RoleCode) {
  return role === "warehouse_manager";
}

export function canVoidSerial(role: RoleCode) {
  return role === "mill_operator";
}

export function canMarkExceptionInReview(role: RoleCode) {
  return role === "fbr_officer";
}

export function canResolveException(role: RoleCode) {
  return role === "auditor";
}
