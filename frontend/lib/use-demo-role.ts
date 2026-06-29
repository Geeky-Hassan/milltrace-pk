"use client";

import { useSyncExternalStore } from "react";
import type { RoleCode } from "@/types";

const STORAGE_KEY = "milltrace-demo-role";
const TOKEN_KEY = "milltrace-demo-token";

export function getStoredRole(): RoleCode {
  if (typeof window === "undefined") {
    return "mill_owner";
  }
  return (window.localStorage.getItem(STORAGE_KEY) as RoleCode | null) ?? "mill_owner";
}

export function setStoredRole(role: RoleCode) {
  window.localStorage.setItem(STORAGE_KEY, role);
  window.dispatchEvent(new CustomEvent("milltrace-role-change", { detail: role }));
}

export function setStoredAuth(role: RoleCode, token: string) {
  window.localStorage.setItem(STORAGE_KEY, role);
  window.localStorage.setItem(TOKEN_KEY, token);
  window.dispatchEvent(new CustomEvent("milltrace-role-change", { detail: role }));
}

export function getStoredToken() {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function useDemoRole() {
  return useSyncExternalStore<RoleCode>(subscribeToRole, getStoredRole, getServerRole);
}

function subscribeToRole(callback: () => void) {
  const handleStorage = () => callback();
  const handleCustom = () => callback();

  window.addEventListener("storage", handleStorage);
  window.addEventListener("milltrace-role-change", handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("milltrace-role-change", handleCustom);
  };
}

function getServerRole(): RoleCode {
  return "mill_owner";
}
