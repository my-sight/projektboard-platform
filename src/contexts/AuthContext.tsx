'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { isSuperuserEmail } from '@/constants/superuser';
import { getLicenseStatus } from '@/lib/license';

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
  refreshProfile: () => Promise<void>;
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
        .maybeSingle();

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

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  };

  useEffect(() => {
    // 1. Initial Sync
    const initAuth = async () => {
      setLoading(true);
      // 1. Initial Session Load
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        // License Check
        // License Check moved to Middleware (src/middleware.ts) for stability
        // const license = await getLicenseStatus();
        // console.log('License Status (Client View):', license);

        if (session?.user) {
          setUser(session.user);
          setProfile(await fetchProfile(session.user.id));
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      });
    };

    initAuth();

    // 2. Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        // Only fetch profile if not already set or if user changed
        if (!profile || profile.id !== session.user.id) {
          const p = await fetchProfile(session.user.id);
          if (!p) {
            // Stale session (user valid in Auth but missing in DB) -> Logout
            console.warn('User has no profile (stale session?). Signing out...');
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          } else {
            setProfile(p);
          }
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });



    return () => {
      subscription.unsubscribe();
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
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
