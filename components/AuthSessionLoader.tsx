'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';
import { logger } from '@/lib/logger';

export default function AuthSessionLoader() {
  const { status, data } = useSession();
  const { startLoading, stopLoading } = useGlobalLoader();
  const startedRef = useRef(false);

  useEffect(() => {
    const hasSession = !!data;
    logger.info(`AuthSessionLoader status: ${status} | hasSession=${hasSession}`);
    if (status === 'loading') {
      if (!startedRef.current) {
        startedRef.current = true;
        startLoading('Checking session…');
      }
    } else {
      stopLoading();
      startedRef.current = false;
    }
  }, [status, data, startLoading, stopLoading]);

  return null;
}
