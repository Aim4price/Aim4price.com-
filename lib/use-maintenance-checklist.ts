"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { maintenanceCatalogueSeed } from "./maintenance-catalogue-seed";
import {
  resolveMaintenanceChecklist,
  type MaintenanceAsset,
  type MaintenanceCatalogue,
} from "./maintenance-catalogue";

export function useMaintenanceChecklist(
  asset: MaintenanceAsset | null,
  locked = false,
) {
  const [catalogue, setCatalogue] = useState<MaintenanceCatalogue>(
    maintenanceCatalogueSeed,
  );
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/maintenance-catalogue", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw Error("Unavailable");
        return r.json();
      })
      .then((data) => {
        if (data.catalogue && !lockedRef.current) setCatalogue(data.catalogue);
      })
      .catch(() => {
        /* Bundled catalogue remains usable without a connection. */
      });
    return () => controller.abort();
  }, []);
  return useMemo(
    () => resolveMaintenanceChecklist(asset, catalogue),
    [asset, catalogue],
  );
}
