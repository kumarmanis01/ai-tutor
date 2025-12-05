'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useGlobalLoader } from '@/context/GlobalLoaderProvider';

export default function AuthSessionLoader() {
  const { status } = useSession();
  const { startLoading, stopLoading } = useGlobalLoader();

  useEffect(() => {
    if (status === 'loading') startLoading('Checking session…');
    else stopLoading();
  }, [status, startLoading, stopLoading]);

  return null;
}
