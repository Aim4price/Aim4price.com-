import { maintenanceCatalogueSeed } from "./maintenance-catalogue-seed";

export type MaintenanceItem = {
  id: string;
  label: string;
  checkLabel: string;
  serviceLabel: string;
  description: string;
};
export type MaintenanceProfile = {
  key: string;
  label: string;
  items: MaintenanceItem[];
};
export type MaintenanceFamily = {
  source: "basic" | "advanced";
  release?: string;
  sector: string;
  familyKey: string;
  familyId?: number;
  label: string;
  profileKey: string;
};
export type MaintenanceCatalogue = {
  version: number;
  profiles: MaintenanceProfile[];
  families: MaintenanceFamily[];
};
export type MaintenanceIdentity = {
  source: "basic" | "advanced" | "unknown";
  release?: string;
  sector?: string;
  familyKey?: string;
  familyId?: number;
  label?: string;
};
export type MaintenanceAsset = {
  maintenanceIdentity?: MaintenanceIdentity;
  equipmentFamilyId?: number | null;
  equipmentFamilyKey?: string | null;
  equipmentFamilyLabel?: string | null;
  sectorId?: number | null;
  sectorKey?: string | null;
  specsJson?: Record<string, unknown>;
};
export type MaintenanceChecklist = {
  version: number;
  family: MaintenanceIdentity;
  profileKey: string;
  label: string;
  items: MaintenanceItem[];
  matched: boolean;
};
export type MaintenanceWorkSnapshot = {
  version: number;
  family: MaintenanceIdentity;
  profileKey: string;
  mode: "checked" | "serviced" | "repaired";
  items: {
    id: string;
    label: string;
    action: "checked" | "serviced" | "repaired";
  }[];
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const sectorIds: Record<number, string> = {
  1: "agricultural",
  2: "industrial",
  3: "construction",
  4: "motor",
};
export function maintenanceIdentity(
  asset: MaintenanceAsset,
): MaintenanceIdentity {
  if (asset.maintenanceIdentity) return asset.maintenanceIdentity;
  const s = asset.specsJson || {};
  const basic = record(s.basic_catalogue) ? s.basic_catalogue : {};
  const basicKey = text(basic.familyKey) || text(s.basic_family_key);
  if (basicKey || s.basic_catalogue_release)
    return {
      source: "basic",
      release:
        text(s.basic_catalogue_release) || text(basic.releaseKey) || undefined,
      sector:
        text(basic.sectorKey) ||
        text(s.basic_sector_key) ||
        text(s.sector_key) ||
        text(asset.sectorKey) ||
        sectorIds[asset.sectorId || 0],
      familyKey: basicKey || undefined,
      label: text(basic.familyLabel) || text(s.basic_family_label) || basicKey,
    };
  return {
    source:
      asset.equipmentFamilyId || asset.equipmentFamilyKey
        ? "advanced"
        : "unknown",
    sector: text(asset.sectorKey) || sectorIds[asset.sectorId || 0],
    familyId: asset.equipmentFamilyId || undefined,
    familyKey: text(asset.equipmentFamilyKey) || undefined,
    label: text(asset.equipmentFamilyLabel) || undefined,
  };
}
export function familyAssignmentKey(f: MaintenanceFamily): string {
  return [f.source, f.release || "", f.sector, f.familyKey].join("/");
}
export function resolveMaintenanceChecklist(
  asset: MaintenanceAsset | null,
  catalogue: MaintenanceCatalogue = maintenanceCatalogueSeed,
): MaintenanceChecklist {
  const identity = asset
    ? maintenanceIdentity(asset)
    : { source: "unknown" as const };
  // A Basic identity never falls back to an unrelated legacy ID. Missing sectors
  // can be recovered only when the key resolves uniquely in the correct source.
  const candidates = catalogue.families.filter(
    (f) =>
      f.source === identity.source &&
      (!identity.sector || f.sector === identity.sector) &&
      (!identity.release || f.release === identity.release) &&
      (identity.source === "advanced" && identity.familyId
        ? f.familyId === identity.familyId
        : f.familyKey === identity.familyKey),
  );
  const family = candidates.length === 1 ? candidates[0] : undefined;
  const profile =
    catalogue.profiles.find((p) => p.key === family?.profileKey) ||
    catalogue.profiles.find((p) => p.key === "general") ||
    maintenanceCatalogueSeed.profiles.find((p) => p.key === "general")!;
  return {
    version: catalogue.version,
    family: family
      ? {
          source: family.source,
          release: family.release,
          sector: family.sector,
          familyKey: family.familyKey,
          familyId: family.familyId,
          label: family.label,
        }
      : identity,
    profileKey: profile.key,
    label: family?.label || identity.label || "General equipment",
    items: profile.items,
    matched: !!family,
  };
}
export function checklistOptions(
  checklist: MaintenanceChecklist,
  mode: "checked" | "serviced" | "repaired",
) {
  return checklist.items.map((i) => ({
    id: i.id,
    label:
      mode === "checked"
        ? i.checkLabel
        : mode === "repaired"
          ? i.label
          : i.serviceLabel,
    description: i.description,
  }));
}
export function buildMaintenanceWorkSnapshot(
  checklist: MaintenanceChecklist,
  mode: MaintenanceWorkSnapshot["mode"],
  selected: string[],
): MaintenanceWorkSnapshot {
  return {
    version: checklist.version,
    family: checklist.family,
    profileKey: checklist.profileKey,
    mode,
    items: checklist.items
      .filter((i) =>
        selected.includes(
          mode === "checked"
            ? i.checkLabel
            : mode === "repaired"
              ? i.label
              : i.serviceLabel,
        ),
      )
      .map((i) => ({
        id: i.id,
        label:
          mode === "checked"
            ? i.checkLabel
            : mode === "repaired"
              ? i.label
              : i.serviceLabel,
        action: mode,
      })),
  };
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function bounded(v: unknown, limit: number): string {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > limit ||
    /[\r\n\u0000-\u001f]/.test(v)
  )
    throw new Error("Invalid maintenance catalogue text.");
  return v.trim();
}
function key(v: unknown): string {
  const s = bounded(v, 120);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(s))
    throw new Error("Invalid maintenance catalogue key.");
  return s;
}
export function validateMaintenanceCatalogue(
  input: unknown,
): MaintenanceCatalogue {
  if (
    !record(input) ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 1 ||
    !Array.isArray(input.profiles) ||
    !Array.isArray(input.families) ||
    input.profiles.length > 1500 ||
    input.families.length > 5000
  )
    throw new Error("Invalid maintenance catalogue.");
  const profiles = input.profiles.map((p): MaintenanceProfile => {
    if (
      !record(p) ||
      !Array.isArray(p.items) ||
      !p.items.length ||
      p.items.length > 80
    )
      throw new Error("Each checklist needs 1–80 items.");
    const items = p.items.map((i): MaintenanceItem => {
      if (!record(i)) throw new Error("Invalid checklist item.");
      return {
        id: key(i.id),
        label: bounded(i.label, 160),
        checkLabel: bounded(i.checkLabel, 160),
        serviceLabel: bounded(i.serviceLabel, 160),
        description: i.description === "" ? "" : bounded(i.description, 300),
      };
    });
    for (const field of ["id", "checkLabel", "serviceLabel"] as const)
      if (new Set(items.map((i) => i[field])).size !== items.length)
        throw new Error("Checklist items must have unique IDs and labels.");
    return { key: key(p.key), label: bounded(p.label, 160), items };
  });
  const keys = new Set(profiles.map((p) => p.key));
  if (keys.size !== profiles.length || !keys.has("general"))
    throw new Error("Keep unique checklist keys and the general checklist.");
  const families = input.families.map((f): MaintenanceFamily => {
    if (!record(f) || !["basic", "advanced"].includes(String(f.source)))
      throw new Error("Invalid family source.");
    const result: MaintenanceFamily = {
      source: f.source as "basic" | "advanced",
      sector: key(f.sector),
      familyKey: key(f.familyKey),
      label: bounded(f.label, 200),
      profileKey: key(f.profileKey),
    };
    if (f.source === "basic") result.release = key(f.release);
    if (f.source === "advanced") {
      if (!Number.isSafeInteger(f.familyId) || Number(f.familyId) < 1)
        throw new Error("Advanced family ID is required.");
      result.familyId = Number(f.familyId);
    }
    if (!keys.has(result.profileKey))
      throw new Error("Family references an unknown checklist.");
    return result;
  });
  if (
    new Set(families.map(familyAssignmentKey)).size !== families.length ||
    new Set(
      families.filter((f) => f.source === "advanced").map((f) => f.familyId),
    ).size !== families.filter((f) => f.source === "advanced").length
  )
    throw new Error("Duplicate family assignment.");
  // Imports may extend the catalogue, but may not silently drop existing coverage.
  const assignments = new Set(families.map(familyAssignmentKey));
  if (
    maintenanceCatalogueSeed.families.some(
      (f) => !assignments.has(familyAssignmentKey(f)),
    )
  )
    throw new Error(
      "Keep every existing Basic and Advanced family assignment.",
    );
  return { version: Number(input.version), profiles, families };
}
export function validateMaintenanceWork(
  input: unknown,
): MaintenanceWorkSnapshot[] | null {
  if (input == null) return null; // Existing clients remain compatible.
  if (!Array.isArray(input) || input.length > 12)
    throw new Error("Invalid maintenance work.");
  return input.map((s) => {
    if (
      !record(s) ||
      !record(s.family) ||
      !Number.isSafeInteger(s.version) ||
      Number(s.version) < 1 ||
      !["checked", "serviced", "repaired"].includes(String(s.mode)) ||
      !Array.isArray(s.items) ||
      s.items.length > 80
    )
      throw new Error("Invalid maintenance work.");
    const mode = s.mode as MaintenanceWorkSnapshot["mode"];
    const family: MaintenanceIdentity = {
      source: s.family.source as MaintenanceIdentity["source"],
    };
    if (!["basic", "advanced", "unknown"].includes(family.source))
      throw new Error("Invalid maintenance family.");
    for (const field of ["release", "sector", "familyKey", "label"] as const)
      if (s.family[field] != null)
        family[field] = bounded(s.family[field], 200);
    if (s.family.familyId != null) {
      if (
        !Number.isSafeInteger(s.family.familyId) ||
        Number(s.family.familyId) < 1
      )
        throw new Error("Invalid maintenance family ID.");
      family.familyId = Number(s.family.familyId);
    }
    const items = s.items.map((i) => {
      if (!record(i) || i.action !== mode)
        throw new Error("Invalid maintenance action.");
      return { id: key(i.id), label: bounded(i.label, 160), action: mode };
    });
    if (new Set(items.map((i) => i.id)).size !== items.length)
      throw new Error("Duplicate maintenance item.");
    return {
      version: Number(s.version),
      family,
      profileKey: key(s.profileKey),
      mode,
      items,
    };
  });
}
