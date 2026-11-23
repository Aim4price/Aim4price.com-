export type SignupIntroducedByOption = '' | 'sender' | 'direct' | 'other';

export function introducedByOptions(sender?: string | null): Array<{value: SignupIntroducedByOption; label: string}> {
  return [
    sender ? {value: 'sender', label: sender} : {value: 'direct', label: 'No one / direct signup'},
    {value: 'other', label: 'Other person or source'},
  ];
}

// Named referrals use the existing profile field so admin and exports display them.
export function introducedByFields(choice: SignupIntroducedByOption, manualName: string, sender?: string | null) {
  if (choice === 'sender' && sender) return {introducedByOption: 'other', introducedByName: sender};
  if (choice === 'other') return {introducedByOption: 'other', introducedByName: manualName.trim()};
  return {introducedByOption: 'direct', introducedByName: ''};
}
