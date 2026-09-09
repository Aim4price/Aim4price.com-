import { headers } from 'next/headers';
import type { AppRealm } from './app-realm';

export async function currentAppRealm(): Promise<AppRealm | null> {
  const value = (await headers()).get('x-aim4price-app-realm');
  return value === 'dealer' || value === 'middleman' || value === 'owner' || value === 'field' ? value : null;
}
