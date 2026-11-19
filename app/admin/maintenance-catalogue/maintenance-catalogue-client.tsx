"use client";
import { useEffect, useState } from "react";
import AdminNavigation from "../../../components/AdminNavigation";
import adminStyles from "../page.module.css";
import {
  familyAssignmentKey,
  validateMaintenanceCatalogue,
  type MaintenanceCatalogue,
  type MaintenanceProfile,
} from "../../../lib/maintenance-catalogue";
import styles from "./page.module.css";

export default function MaintenanceCatalogueClient() {
  const [data, setData] = useState<MaintenanceCatalogue | null>(null);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [selected, setSelected] = useState("");
  const [openItem, setOpenItem] = useState("");
  const [profileQuery, setProfileQuery] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const protectNavigation = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm("Discard unsaved checklist changes and leave this page?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", prevent);
    document.addEventListener("click", protectNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", prevent);
      document.removeEventListener("click", protectNavigation, true);
    };
  }, [dirty]);
  function selectAvailableFamily(catalogue: MaintenanceCatalogue) {
    setSelected(current => catalogue.families.some(f => familyAssignmentKey(f) === current)
      ? current : catalogue.families.length ? familyAssignmentKey(catalogue.families[0]) : "");
    setOpenItem("");
  }
  async function load() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/maintenance-catalogue", {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d.catalogue);
      selectAvailableFamily(d.catalogue);
      setVersion(d.catalogue.version);
      setDirty(false);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load catalogue.");
    } finally {
      setBusy(false);
    }
  }
  function change(next: MaintenanceCatalogue) {
    setData(next);
    setDirty(true);
    setMessage("Unsaved changes");
  }
  const family = data?.families.find(
    (f) => familyAssignmentKey(f) === selected,
  );
  const profile = data?.profiles.find((p) => p.key === family?.profileKey);
  const users =
    data?.families.filter((f) => f.profileKey === profile?.key).length || 0;
  function updateProfile(next: MaintenanceProfile) {
    if (data)
      change({
        ...data,
        profiles: data.profiles.map((p) => (p.key === next.key ? next : p)),
      });
  }
  async function save() {
    if (!data) return;
    setBusy(true);
    try {
      validateMaintenanceCatalogue(data);
      const r = await fetch("/api/admin/maintenance-catalogue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogue: data, expectedVersion: version }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d.catalogue);
      setVersion(d.catalogue.version);
      setDirty(false);
      setMessage("Catalogue saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  function exportCatalogue() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "aim4price-maintenance-catalogue.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importCatalogue(file?: File) {
    if (!file || busy) return;
    if (dirty && !window.confirm("Replace your unsaved checklist changes with this import?")) return;
    setBusy(true);
    try {
      if (file.size > 2500000)
        throw Error("Import must be smaller than 2.5 MB.");
      const next = validateMaintenanceCatalogue(JSON.parse(await file.text()));
      change({ ...next, version });
      selectAvailableFamily(next);
      setMessage("Import loaded for review. Save to apply.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invalid import.");
    } finally {
      setBusy(false);
    }
  }
  const families =
    data?.families.filter(
      (f) =>
        (source === "all" || f.source === source) &&
        `${f.sector} ${f.label} ${f.familyKey}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ) || [];
  return (
    <main className={adminStyles.page}>
      <section className={adminStyles.shell}>
      <header className={adminStyles.topBar}>
        <div className={adminStyles.titleBlock}>
          <h1>Maintenance checklists</h1>
        </div>
        <AdminNavigation active="maintenance-catalogue" />
      </header>
      <div className={styles.page}>
      <div className={styles.toolbar}>
        <p role="status">
          {message || (data
            ? `${data.families.length} ${data.families.length === 1 ? "family" : "families"} · ${data.profiles.length} ${data.profiles.length === 1 ? "checklist" : "checklists"}`
            : "Loading…")}
        </p>
        <button className={styles.saveButton} disabled={busy || !dirty} onClick={save}>
          {busy ? "Please wait…" : "Save changes"}
        </button>
        <button disabled={!data || busy} onClick={exportCatalogue}>
          Export catalogue
        </button>
        <label className={styles.upload}>
          Import catalogue
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy || !data}
            onChange={(e) => {
              void importCatalogue(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => {
            if (!dirty || confirm("Discard unsaved changes and reload?"))
              void load();
          }}
        >
          Reload
        </button>
      </div>
      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.sectionHeading}><h2>Asset families</h2><span>{families.length}</span></div>
          <input
            aria-label="Find a family"
            placeholder="Search family or sector"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.filters}>
            {["all", "basic", "advanced"].map((s) => (
              <button
                key={s}
                aria-pressed={source === s}
                onClick={() => setSource(s)}
              >
                {s === "all" ? "All" : s === "basic" ? "Basic" : "Advanced"}
              </button>
            ))}
          </div>

          {data && !families.length ? <p>No families match these filters.</p> : null}
          <div className={styles.list}>
            {families.map((f) => (
              <button
                key={familyAssignmentKey(f)}
                aria-pressed={selected === familyAssignmentKey(f)}
                onClick={() => {
                  setSelected(familyAssignmentKey(f));
                  setProfileQuery("");
                  setOpenItem("");
                }}
              >
                <strong title={f.label}>{f.label}</strong>
                <small>
                  {f.sector} · {f.source}
                </small>
              </button>
            ))}
          </div>
        </section>
        <section className={styles.panel}>
          {family && profile && data ? (
            <>
              <header className={styles.editorHeader}>
                <h2>{family.label}</h2>
                <p>{users === 1 ? "Only this family uses this checklist." : `Changes apply to all ${users} assigned families.`}</p>
              </header>
              <button
                disabled={busy}
                onClick={() => {
                  const key = `custom_${Date.now()}`;
                  const copy = {
                    ...profile,
                    key,
                    label: family.label,
                    items: profile.items.map((i) => ({ ...i })),
                  };
                  change({
                    ...data,
                    profiles: [...data.profiles, copy],
                    families: data.families.map((f) =>
                      familyAssignmentKey(f) === selected
                        ? { ...f, profileKey: key }
                        : f,
                    ),
                  });
                }}
              >
                Create family-only copy
              </button>
              <details key={selected}>
                <summary>Use another checklist</summary>
                <p>Past records keep their original wording.</p>
                <input
                  placeholder="Find checklist"
                  aria-label="Find checklist"
                  value={profileQuery}
                  onChange={(e) => setProfileQuery(e.target.value)}
                />
                <div className={styles.choices}>
                  {data.profiles
                    .filter((p) =>
                      p.label
                        .toLowerCase()
                        .includes(profileQuery.toLowerCase()),
                    )
                    .map((p) => (
                      <button
                        key={p.key}
                        disabled={busy}
                        aria-pressed={profile.key === p.key}
                        onClick={() => {
                          setOpenItem("");
                          change({
                            ...data,
                            families: data.families.map((f) =>
                              familyAssignmentKey(f) === selected
                                ? { ...f, profileKey: p.key }
                                : f,
                            ),
                          });
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                </div>
              </details>
              <label>
                Checklist name
                <input
                  value={profile.label}
                  disabled={busy}
                  onChange={(e) =>
                    updateProfile({ ...profile, label: e.target.value })
                  }
                />
              </label>
              <div className={styles.sectionHeading}>
                <h3>Checklist items</h3><span>{profile.items.length}</span>
              </div>
              {profile.items.map((item, index) => (
                <div className={styles.item} key={item.id}>
                  <button type="button" className={styles.itemToggle}
                    aria-expanded={openItem === item.id}
                    onClick={() => setOpenItem(openItem === item.id ? "" : item.id)}>
                    <span>{index + 1}</span><strong>{item.label || "Unnamed component"}</strong>
                    <small>{openItem === item.id ? "Close" : "Edit"}</small>
                  </button>
                  {openItem === item.id && <div className={styles.fields}>
                    {(
                      [
                        "label",
                        "checkLabel",
                        "serviceLabel",
                        "description",
                      ] as const
                    ).map((field) => (
                      <label key={field}>
                        {
                          {
                            label: "Component",
                            checkLabel: "Check wording",
                            serviceLabel: "Service wording",
                            description: "Help text",
                          }[field]
                        }
                        <input
                          value={item[field]}
                          disabled={busy}
                          maxLength={field === "description" ? 300 : 160}
                          onChange={(e) =>
                            updateProfile({
                              ...profile,
                              items: profile.items.map((i) =>
                                i.id === item.id
                                  ? { ...i, [field]: e.target.value }
                                  : i,
                              ),
                            })
                          }
                        />
                      </label>
                    ))}
                    <button
                      disabled={busy || profile.items.length < 2}
                      onClick={() =>
                        updateProfile({
                          ...profile,
                          items: profile.items.filter((i) => i.id !== item.id),
                        })
                      }
                    >
                      Remove item
                    </button>
                  </div>}
                </div>
              ))}
              <button
                disabled={busy || profile.items.length >= 80}
                onClick={() => {
                  const id = `item_${Date.now()}`;
                  setOpenItem(id);
                  updateProfile({
                    ...profile,
                    items: [
                      ...profile.items,
                      {
                        id,
                        label: "New component",
                        checkLabel: "New component",
                        serviceLabel: "New component",
                        description:
                          "Select only if fitted and work was completed.",
                      },
                    ],
                  });
                }}
              >
                Add item
              </button>
            </>
          ) : (
            <p>Choose a family to edit its checklist.</p>
          )}
        </section>
      </div>
      </div>
      </section>
    </main>
  );
}
