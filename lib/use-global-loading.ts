'use client';

import { useEffect } from 'react';
import { setGlobalLoading } from './global-loading';

export function useGlobalLoading(isLoading: boolean, key: string) {
  useEffect(() => {
    setGlobalLoading(isLoading, key);

    return () => {
      setGlobalLoading(false, key);
    };
  }, [isLoading, key]);
}
