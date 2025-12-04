import useSWR from 'swr';
import { useSession } from 'next-auth/react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useCurrentUser() {
  const { data: session } = useSession();
  const shouldFetch = !!session;
  const { data, error, isLoading, mutate } = useSWR(shouldFetch ? '/api/user/profile' : null, fetcher);
  return { data, error, loading: isLoading, signedIn: !!session, mutate };
}

export default useCurrentUser;
