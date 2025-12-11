'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { isSuperuserEmail } from '@/constants/superuser';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  company: string | null;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Error fetching profile:', error);
        return null;
      }
      return data as Profile;
    } catch (e) {
      console.error('Fetch profile exception:', e);
      return null;
    }
  };

  useEffect(() => {
    // 1. Initial Sync
    const initAuth = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    };

    initAuth();

    // 2. Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        // Only fetch profile if not already set or if user changed
        if (!profile || profile.id !== session.user.id) {
          const p = await fetchProfile(session.user.id);
          setProfile(p);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // 3. Lockout Check Loop (every 30s)
    const checkLockout = async () => {
      try {
        const { data: record } = await supabase
          .from('system_settings')
          .select('*')
          .eq('key', 'lockout')
          .single();

        if (record && record.value && record.value.enabled && record.value.lockoutTime) {
          const lockoutTime = new Date(record.value.lockoutTime).getTime();
          const now = Date.now(); // Using local time for simplicity in local dev

          if (now > lockoutTime) {
            // Locked!
            // Check if superuser
            const { data: { user } } = await supabase.auth.getUser();

            // We need profile for role check
            let currentProfile = profile;
            if (user && !currentProfile) {
              currentProfile = await fetchProfile(user.id);
            }

            const email = user?.email;
            const role = currentProfile?.role;
            const isSuper = isSuperuserEmail(email) || role === 'superuser';

            if (!isSuper) {
              if (!window.location.pathname.includes('/locked') && !window.location.pathname.includes('/login')) {
                window.location.href = '/locked';
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    };

    const interval = setInterval(checkLockout, 10000);
    checkLockout();

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email: string, password: string) => {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        // Default metadata
        data: {
          full_name: email.split('@')[0],
        }
      }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin' || isSuperuserEmail(user?.email);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
