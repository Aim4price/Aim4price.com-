'use client';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PhoneNotificationSettings from './PhoneNotificationSettings';
import type { PushApp } from '../lib/push-policy';
import styles from './PhoneNotificationSettings.module.css';
export default function NotificationSettingsModal({ app }: { app: PushApp }) {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open,setOpen] = useState(false);
  return <>
    <button ref={trigger} type="button" className={styles.gear} aria-label="Notification settings" title="Notification settings" aria-haspopup="dialog"
      onClick={()=>setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9 3-.6 2.2-1.8 1L4.4 6 2.9 8.6l1.6 1.7v2.1l-1.6 1.7L4.4 17l2.2-.3 1.8 1L9 20h3l.6-2.3 1.8-1 2.2.3 1.5-2.9-1.6-1.7v-2.1l1.6-1.7L16.6 6l-2.2.2-1.8-1L12 3Z" transform="translate(1.5 .5)"/><circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    {open && typeof document !== 'undefined' ? createPortal(<dialog ref={node=>{dialog.current=node;if(node&&!node.open)node.showModal();}}
      className={styles.dialog} aria-labelledby="phone-notification-settings-title" onClose={()=>{setOpen(false);trigger.current?.focus();}}
      onClick={event=>{if(event.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.current.close();}}}>
      <header className={styles.modalHeading}><h2 id="phone-notification-settings-title">Notification settings</h2>
        <button type="button" className={styles.close} aria-label="Close notification settings" onClick={()=>dialog.current?.close()}>×</button></header>
      <PhoneNotificationSettings app={app} modal />
      <button type="button" className={styles.button} onClick={()=>dialog.current?.close()}>Done</button>
    </dialog>,document.body):null}
  </>;
}
