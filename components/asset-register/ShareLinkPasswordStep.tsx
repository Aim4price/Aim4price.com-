'use client';

import { useId, useState } from 'react';
import styles from './ShareLinkPasswordStep.module.css';

export type LinkPasswordChoice = 'none' | 'set' | 'keep' | 'remove';

const options = {
  none: { title: 'No password', description: 'Recipients sign in to open the shared assets.' },
  set: { title: 'Add a password', description: 'Recipients enter your password before signing in.' },
  keep: { title: 'Keep current password', description: 'Recipients continue using the same password.' },
  remove: { title: 'Remove password', description: 'Recipients only need to sign in.' },
};

function PasswordIcon({ lock = false }: { lock?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    {lock ? <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </> : <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>}
  </svg>;
}

export default function ShareLinkPasswordStep({ choice, onChoiceChange, password, onPasswordChange, protectedLink = false, disabled = false }: {
  choice: LinkPasswordChoice | null;
  onChoiceChange: (choice: LinkPasswordChoice) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  protectedLink?: boolean;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const choices: LinkPasswordChoice[] = protectedLink ? ['keep', 'set', 'remove'] : ['none', 'set'];

  return <div className={styles.passwordSlide}>
    <p>{protectedLink ? 'How would you like to protect this link?' : 'Would you like to add a password?'}</p>
    <div className={styles.passwordChoices} data-link-password-choices role="group" aria-label="Asset link password protection">
      {choices.map(option => <button key={option} type="button" disabled={disabled} aria-pressed={choice === option} onClick={() => {
        setShowPassword(false);
        onChoiceChange(option);
      }}>
        <span className={styles.passwordChoiceIcon}><PasswordIcon lock={option === 'keep' || option === 'set'} /></span>
        <span>
          <strong>{protectedLink && option === 'set' ? 'Change password' : options[option].title}</strong>
          <small>{options[option].description}</small>
        </span>
      </button>)}
    </div>
    {choice === 'set' && <div className={styles.passwordInputPanel}>
      <label htmlFor={inputId}>{protectedLink ? 'New link password' : 'Link password'}</label>
      <div>
        <input id={inputId} type={showPassword ? 'text' : 'password'} autoComplete="new-password"
          maxLength={128} value={password} disabled={disabled} aria-describedby={`${inputId}-hint`}
          onChange={event => onPasswordChange(event.target.value)} placeholder="At least 8 characters" />
        <button type="button" disabled={disabled} aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}><PasswordIcon /></button>
      </div>
      <small id={`${inputId}-hint`}>{password.length > 0 && password.length < 8 ? 'Use at least 8 characters.' : 'Send the password separately.'}</small>
    </div>}
  </div>;
}
