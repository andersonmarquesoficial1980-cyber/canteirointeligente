import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export interface NavigationTrailItem {
  path: string;
  label: string;
}

interface UseNavigationTrailOptions {
  label: string;
  path?: string;
  includeSearch?: boolean;
  resetToHome?: boolean;
}

const STORAGE_KEY = "wf_navigation_trail_v1";
const HOME_ITEM: NavigationTrailItem = { path: "/", label: "Home" };

function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

function normalizePath(value: string): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed || !isInternalPath(trimmed)) return null;
  return trimmed;
}

function readTrail(): NavigationTrailItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: any) => ({
        path: normalizePath(String(item?.path || "")),
        label: String(item?.label || "").trim(),
      }))
      .filter((item: any) => item.path && item.label) as NavigationTrailItem[];
  } catch {
    return [];
  }
}

function writeTrail(trail: NavigationTrailItem[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trail));
  } catch {
    // ignore
  }
}

function ensureHome(trail: NavigationTrailItem[]): NavigationTrailItem[] {
  if (trail.length === 0) return [HOME_ITEM];
  if (trail[0].path === HOME_ITEM.path) {
    if (trail[0].label !== HOME_ITEM.label) {
      return [{ ...HOME_ITEM }, ...trail.slice(1)];
    }
    return trail;
  }
  return [HOME_ITEM, ...trail.filter((item) => item.path !== HOME_ITEM.path)];
}

function upsertAndTrim(trail: NavigationTrailItem[], item: NavigationTrailItem): NavigationTrailItem[] {
  const idx = trail.findIndex((entry) => entry.path === item.path);

  if (idx >= 0) {
    const next = trail.slice(0, idx + 1);
    next[idx] = item;
    return next;
  }

  return [...trail, item];
}

export function useNavigationTrail(options: UseNavigationTrailOptions) {
  const { label, path, includeSearch = false, resetToHome = false } = options;
  const navigate = useNavigate();
  const location = useLocation();

  const currentPath = useMemo(() => {
    const base = path || location.pathname;
    const full = includeSearch ? `${base}${location.search}` : base;
    return normalizePath(full);
  }, [path, location.pathname, location.search, includeSearch]);

  const [trail, setTrail] = useState<NavigationTrailItem[]>(() => ensureHome(readTrail()));

  useEffect(() => {
    if (!currentPath || !label?.trim()) return;

    const currentItem: NavigationTrailItem = { path: currentPath, label: label.trim() };
    let nextTrail = ensureHome(readTrail());

    if (currentPath === "/") {
      nextTrail = [HOME_ITEM];
    } else if (resetToHome) {
      nextTrail = [HOME_ITEM, currentItem];
    } else {
      nextTrail = upsertAndTrim(nextTrail, currentItem);
    }

    writeTrail(nextTrail);
    setTrail(nextTrail);
  }, [currentPath, label, resetToHome]);

  const goTo = useCallback(
    (pathToGo: string) => {
      const normalized = normalizePath(pathToGo);
      if (!normalized) return;

      const current = ensureHome(readTrail());
      const idx = current.findIndex((item) => item.path === normalized);
      if (idx >= 0) {
        const trimmed = current.slice(0, idx + 1);
        writeTrail(trimmed);
        setTrail(trimmed);
      }

      navigate(normalized);
    },
    [navigate],
  );

  return { trail, goTo };
}
