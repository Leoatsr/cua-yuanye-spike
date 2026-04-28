import { useSyncExternalStore } from 'react';
import {
  getAuthSnapshot,
  subscribeAuth,
  authSignIn,
  authSignOut,
  type AuthSnapshot,
  type AuthUser,
} from '../lib/authStore';

export type { AuthUser };

/**
 * Subscribe via useSyncExternalStore — purpose-built for external stores.
 * Avoids the strict-mode double-mount race that useState+useEffect has.
 */
export function useAuth() {
  const state: AuthSnapshot = useSyncExternalStore(
    (onChange) => subscribeAuth(onChange),
    getAuthSnapshot,
    getAuthSnapshot,
  );

  return {
    user: state.user,
    loading: state.loading,
    authEnabled: state.authEnabled,
    signIn: authSignIn,
    signOut: authSignOut,
  };
}
