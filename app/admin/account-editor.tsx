"use client";

import { useRef, useState, type FormEvent } from "react";
import AdminSelect from "../../components/AdminSelect";
import { ACCOUNT_STATUS_VALUES, accountStatusLabel, type AccountStatus } from "../../lib/account-constants";
import { SIGNUP_ACCOUNT_TYPE_OPTIONS, SIGNUP_ACCOUNT_SUBTYPE_OPTIONS, adminAccountLabel, adminCategoryLabel, type SignupAccountType } from "../../lib/account-type-options";
import type { AdminUserRow } from "../../lib/admin-users";
import { isMiddlemanAccountSubtype } from "../../lib/middleman-account";
import { hasDesktopAccess } from "../../lib/account-entitlements";
import styles from "./page.module.css";

export default function AccountEditor({account, onSaved, onCancel, onExisting}: {
  account?: AdminUserRow;
  onSaved: (user: AdminUserRow) => void;
  onExisting?: (user: AdminUserRow) => void;
  onCancel?: () => void;
}) {
  const existingType = isMiddlemanAccountSubtype(account?.accountSubtype) ? "middleman" : account?.accountType;
  const [type, setType] = useState<SignupAccountType>(() => SIGNUP_ACCOUNT_TYPE_OPTIONS.find(option => option.value === existingType)?.value ?? "owner");
  const [subtype, setSubtype] = useState(account?.accountSubtype ?? "farmer");
  const [status, setStatus] = useState<AccountStatus>("active");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState<AdminUserRow | null>(null);
  const options = SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[type];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setDuplicate(null);
    try {
      const body = account
        ? {action:"change_type",userId:account.userId,previousType:account.accountType,previousSubtype:account.accountSubtype}
        : {action:"create",name:form.get("name"),email:form.get("email"),status};
      const response = await fetch("/api/admin/users/manage", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...body,type,subtype}),
      });
      const result = await response.json();
      if (response.status === 409 && result.existing && onExisting) { setDuplicate(result.existing); return; }
      if (!response.ok) throw new Error(result.error || "Unable to save the account.");
      onSaved(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the account.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function changeType(value: SignupAccountType) {
    setType(value);
    setSubtype(value === "business" ? "contributor" : SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[value][0].value);
  }

  return <form onSubmit={save} className={styles.accountEditor} aria-label={account ? "Change account type" : "Add account"}>
    {!account && <><h2>Add account</h2>
      <label className={styles.notificationField}><span>Client or business name</span><input name="name" required maxLength={200} autoFocus disabled={busy}/></label>
      <label className={styles.notificationField}><span>Login email</span><input name="email" type="email" onChange={() => setDuplicate(null)} required maxLength={254} disabled={busy}/></label></>}
    <label className={styles.notificationField}><span>Account type</span>
      <AdminSelect value={type} disabled={busy} onChange={event => changeType(event.target.value as SignupAccountType)}>
        {SIGNUP_ACCOUNT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{adminAccountLabel(option.value,"")}</option>)}
      </AdminSelect></label>
    {type === "middleman" ? <div className={styles.fixedCategory}><strong>Middleman category</strong><span>Equipment middleman</span></div> :
    <label className={styles.notificationField}><span>{type === "business" ? "Business service" : type === "owner" ? "Owner category" : "Business category"}</span>
      <AdminSelect value={subtype} disabled={busy} onChange={event => setSubtype(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{adminCategoryLabel(option.value,option.label)}</option>)}
      </AdminSelect></label>}
    {!account && <label className={styles.notificationField}><span>Account status</span>
      <AdminSelect value={status} disabled={busy} onChange={event => setStatus(event.target.value as AccountStatus)}>
        {ACCOUNT_STATUS_VALUES.map(value => <option key={value} value={value}>{accountStatusLabel(value)}</option>)}
      </AdminSelect></label>}
    {account && <section className={styles.typePreview} aria-label="Account change preview">
      <a className={styles.nameSecondaryButton} href={'/admin/billing?account='+encodeURIComponent(account.userId)}>Manage billing and holds</a>
      <h3>Review the change for {account.name}</h3>
      <p>{account.email} · {account.accountStatusLabel}</p>
      <table><thead><tr><th scope="col">Account details</th><th scope="col">Current</th><th scope="col">After saving</th></tr></thead>
        <tbody>{previewRows(account,type,subtype).map(([label,current,next]) => <tr key={label} data-changed={current !== next}><th scope="row">{label}</th><td>{current}</td><td>{next}</td></tr>)}</tbody>
      </table>
    </section>}
    {duplicate && <div role="alert"><p>This email already belongs to {duplicate.name} ({duplicate.email}).</p><button type="button" className={styles.nameSecondaryButton} onClick={() => onExisting?.(duplicate)}>Open existing account</button></div>}
    {error && <p role="alert">{error}</p>}
    <div className={styles.headerActions}>
      <button className={styles.notificationSendButton} disabled={busy || !options.some(option => option.value === subtype) || Boolean(account && existingType === type && account.accountSubtype === subtype)}>
        {busy ? "Saving…" : account ? existingType === type ? "Save category" : `Change to ${adminAccountLabel(type,subtype,account?.accountType === type && account.paidBusiness)}` : "Create account"}
      </button>
      {onCancel && <button type="button" className={styles.nameSecondaryButton} disabled={busy} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}

function previewRows(account: AdminUserRow, type: SignupAccountType, subtype: string) {
  const nextType = type === "middleman" ? "dealer" : type;
  const currentPlan = account.sharingPlan;
  const nextPlan = type === "business" ? "free" : account.accountType === "business" ? "desktop" : currentPlan;
  function desktop(t: string, plan: string) {
    return plan === "desktop" && hasDesktopAccess({accountType:t,accountStatus:account.accountStatus}) ? "Available" : "Unavailable";
  }
  function directory(t: string, enabled: boolean) {
    if (t !== "dealer" || !enabled) return "Hidden";
    return account.directoryStatus === "approved" ? "Listed" : "Hidden";
  }
  const category = (value: string) => Object.values(SIGNUP_ACCOUNT_SUBTYPE_OPTIONS).flat().find(o => o.value === value)?.label ?? value;
  return [
    ["Workspace", adminAccountLabel(account.accountType,account.accountSubtype,account.paidBusiness), adminAccountLabel(type,subtype,account?.accountType === type && account.paidBusiness)],
    ["Category", adminCategoryLabel(account.accountSubtype,category(account.accountSubtype)), adminCategoryLabel(subtype,category(subtype))],
    ["Desktop access", desktop(account.accountType,currentPlan), desktop(nextType,nextPlan)],
    ["Sharing plan", currentPlan === "free" ? "Free" : "Desktop", nextPlan === "free" ? "Free" : "Desktop"],
    ["Partner directory", directory(account.accountType,account.directoryEnabled), directory(nextType,type !== "middleman" && account.directoryEnabled)],
  ];
}
