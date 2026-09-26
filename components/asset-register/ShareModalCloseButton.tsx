import type { ButtonHTMLAttributes } from 'react';
import styles from './ShareModalCloseButton.module.css';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

/** Match the account/password close control throughout the sharing flow. */
export default function ShareModalCloseButton(props: Props) {
  return <button {...props} type="button" className={styles.close}>
    <span aria-hidden="true">×</span>
  </button>;
}
