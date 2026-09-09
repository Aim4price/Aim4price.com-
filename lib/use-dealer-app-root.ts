'use client';
import { usePathname } from 'next/navigation';

export function useDealerAppRoot(): '/dealer' | '/middleman' {
  const pathname = usePathname();
  return pathname === '/middleman' || pathname?.startsWith('/middleman/') ? '/middleman' : '/dealer';
}
