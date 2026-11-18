"use client";

import { useRef, useState, type FormEvent } from "react";
import AdminSelect from "../../components/AdminSelect";
import { ACCOUNT_STATUS_VALUES, accountStatusLabel, type AccountStatus } from "../../lib/account-constants";
import { SIGNUP_ACCOUNT_TYPE_OPTIONS, SIGNUP_ACCOUNT_SUBTYPE_OPTIONS, type SignupAccountType } from "../../lib/account-type-options";
import type { AdminUserRow } from "../../lib/admin-users";
import { isMiddlemanAccountSubtype } from "../../lib/middleman-account";
import styles from "./page.module.css";

export default function AccountEditor({account, onSaved, onCancel}: {
  account?: AdminUserRow;
  onSaved: (user: AdminUserRow) => void;
  onCancel?: () => void;
}) {
  const existingType = isMiddlemanAccountSubtype(account?.accountSubtype) ? "middleman" : account?.accountType;
  const [type, setType] = useState<SignupAccountType>(() => SIGNUP_ACCOUNT_TYPE_OPTIONS.find(option => option.value === existingType)?.value ?? "owner");
  const [subtype, setSubtype] = useState(account?.accountSubtype ?? "farmer");
  const [status, setStatus] = useState<AccountStatus>("active");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const options = SIGNUP_ACCOUNT_SUBTYPE_OPTIONS[type];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const body = account
        ? {action:"change_type",userId:account.userId,previousType:account.accountType,previousSubtype:account.accountSubtype}
        : {action:"create",name:form.get("name"),email:form.get("email"),status};
      const response = await fetch("/api/admin/users/manage", {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...body,type,subtype}),
      });
      const result = await response.json();
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
      <label className={styles.notificationField}><span>Login email</span><input name="email" type="email" required maxLength={254} disabled={busy}/></label></>}
    <label className={styles.notificationField}><span>Account type</span>
      <AdminSelect value={type} disabled={busy} onChange={event => changeType(event.target.value as SignupAccountType)}>
        {SIGNUP_ACCOUNT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </AdminSelect></label>
    <label className={styles.notificationField}><span>Account subtype</span>
      <AdminSelect value={subtype} disabled={busy} onChange={event => setSubtype(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </AdminSelect></label>
    {!account && <label className={styles.notificationField}><span>Account status</span>
      <AdminSelect value={status} disabled={busy} onChange={event => setStatus(event.target.value as AccountStatus)}>
        {ACCOUNT_STATUS_VALUES.map(value => <option key={value} value={value}>{accountStatusLabel(value)}</option>)}
      </AdminSelect></label>}
    <p>{account ? `Changes the workspace for ${account.name} (${account.email}). Existing records stay with this login. Some tools may be unavailable in the new workspace.` : "After creating the account, use Send password reset to invite the client to set a password."}</p>
    {error && <p role="alert">{error}</p>}
    <div className={styles.headerActions}>
      <button className={styles.notificationSendButton} disabled={busy || !options.some(option => option.value === subtype) || Boolean(account && existingType === type && account.accountSubtype === subtype)}>
        {busy ? "Saving…" : account ? "Save account type" : "Create account"}
      </button>
      {onCancel && <button type="button" className={styles.nameSecondaryButton} disabled={busy} onClick={onCancel}>Cancel</button>}
    </div>
  </form>;
}
