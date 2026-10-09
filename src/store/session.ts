import { create } from 'zustand';
import type { User } from '@/types/models';
import { getCurrentUser } from '@/api/users';
import { onChange } from '@/api/sync';

interface SessionState {
  user: User | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  refresh: async () => {
    try {
      const user = await getCurrentUser();
      set({ user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
}));

// Keep wallet balance / profile fresh when another tab (e.g. admin) changes users.
onChange((changed) => {
  if (changed.includes('users')) void useSession.getState().refresh();
});

/** The signed-in customer. Only use inside routes guarded by RequireUser. */
export function useUser(): User {
  const user = useSession((s) => s.user);
  if (!user) throw new Error('useUser called without a signed-in user');
  return user;
}
