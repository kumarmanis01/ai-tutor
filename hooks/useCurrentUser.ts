import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import type { User } from '@/lib/types';

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<User>);

export function useCurrentUser() {
  const { data: session } = useSession();
  const shouldFetch = !!session;
  const { data, error, isLoading, mutate } = useSWR<User | undefined>(shouldFetch ? '/api/user/profile' : null, fetcher);
  return { data, error, loading: isLoading, signedIn: !!session, mutate } as {
    data?: User;
    error: any;
    loading: boolean;
    signedIn: boolean;
    mutate: any;
  };
}

export default useCurrentUser;
