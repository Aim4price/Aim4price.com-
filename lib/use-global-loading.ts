'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isGlobalLoadingDisabledPath, setGlobalLoading } from './global-loading';

export function useGlobalLoading(isLoading: boolean, key: string) {
  const pathname = usePathname();
  const isDisabledPath = isGlobalLoadingDisabledPath(pathname);

  useEffect(() => {
    setGlobalLoading(isLoading && !isDisabledPath, key);

    return () => {
      setGlobalLoading(false, key);
    };
  }, [isDisabledPath, isLoading, key]);
}
