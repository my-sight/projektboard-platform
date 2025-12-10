'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AuthModel } from 'pocketbase';
import { pb } from '@/lib/pocketbase';
import { isSuperuserEmail } from '@/constants/superuser';

interface AuthContextType {
  user: AuthModel | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Initial Sync
    setUser(pb.authStore.model);
    setLoading(false);

    // 2. Subscribe to auth changes
    const unsub = pb.authStore.onChange((token, model) => {
      setUser(model);
    });

    // 3. Lockout Check Loop (every 30s)
    const checkLockout = async () => {
      try {
        // Fetch the lockout setting. The 'updated' field gives us Server Time.
        // We use a filter to get the specific key.
        const record = await pb.collection('system_settings').getFirstListItem('key="lockout"');

        if (record && record.value && record.value.enabled && record.value.lockoutTime) {
          const lockoutTime = new Date(record.value.lockoutTime).getTime();

          // Server Time Calculation
          let now = Date.now();
          try {
            // Try to get server time via header
            const response = await fetch(pb.baseUrl + '/api/health'); // effectively a ping
            const dateHeader = response.headers.get('Date');
            if (dateHeader) {
              now = new Date(dateHeader).getTime();
            }
          } catch (e) {
            console.log("Could not sync time, using local");
          }

          if (now > lockoutTime) {
            // Locked!
            // Check if superuser
            const user = pb.authStore.model;
            const email = user?.email;
            const role = (user as any)?.role;

            const isSuper = isSuperuserEmail(email) || role === 'admin'; // Basic check

            if (!isSuper) {
              // Redirect to locked page if not already there
              if (!window.location.pathname.includes('/locked') && !window.location.pathname.includes('/login')) {
                window.location.href = '/locked';
              }
            }
          }
        }
      } catch (e: any) {
        // 404 if not found, ignore
      }
    };

    const interval = setInterval(checkLockout, 10000); // Check every 10s
    checkLockout(); // Initial check

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    return pb.collection('users').authWithPassword(email, password);
  };

  const signUp = async (email: string, password: string) => {
    return pb.collection('users').create({ email, password, passwordConfirm: password });
  };

  const signOut = async () => {
    pb.authStore.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
