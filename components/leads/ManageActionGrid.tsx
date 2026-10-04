'use client';
import { Children, Fragment, cloneElement, isValidElement, type ReactNode, type ReactElement } from 'react';
import styles from './ManageActionGrid.module.css';

const order = ['history','details','reports','addPhotos','location','addMaintenance','maintenanceSchedules','loggedProblems','addCosts','suggestValue','corrections','serialNumber','replacementPrice','maintenanceReports','costOfOwnership','documents','whatsapp','email','qr','access'];
function flatten(children: ReactNode, prefix = ""): ReactElement[] {
  return Children.toArray(children).flatMap(child => isValidElement(child)
    ? child.type === Fragment ? flatten((child.props as {children:ReactNode}).children, `${prefix}${child.key}/`) : [cloneElement(child, {key: `${prefix}${child.key}`})]
    : []);
}
/** Sort rendered actions as well as their keyboard focus order. Permission gates stay with callers. */
export default function ManageActionGrid({children,className}: {children:ReactNode;className:string}) {
  const rank = (child:ReactElement) => {
    const action=(child.props as {'data-manage-action'?:string})['data-manage-action'];
    const index=order.indexOf(action || '');
    return index < 0 ? order.length : index;
  };
  return <div className={`${className} ${styles.grid}`} data-manage-actions>{flatten(children).sort((a,b)=>rank(a)-rank(b))}</div>;
}
