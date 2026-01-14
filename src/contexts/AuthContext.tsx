'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, getSupabaseConfig } from '@/lib/supabaseClient';
import { generateUUID } from '@/lib/uuid';
import { isSuperuserEmail } from '@/constants/superuser';
import { getLicenseStatus } from '@/lib/license';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  alias: string | null;
  avatar_url: string | null;
  role: string;
  company: string | null;
  department_id: string | null;
  department_name?: string | null;
  preferred_language: 'de' | 'en' | 'pl' | 'cn' | null;
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
  updateProfile: (updates: Partial<Profile>) => Promise<{ data: any; error: any }>;
  updatePassword: (newPassword: string) => Promise<{ data: any; error: any }>;
  visibilityCounter: number;
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
  const [visibilityCounter, setVisibilityCounter] = useState(0);

  const fetchProfile = useCallback(async (userId: string) => {
    // Add a safety timeout for the profile fetch
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
    );

    try {
      const fetchPromise = supabase
        .from('profiles')
        .select('*, departments(name)')
        .eq('id', userId)
        .maybeSingle();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) {
        console.warn('Error fetching profile:', error);
        return null;
      }

      const profileData = data as any;
      if (profileData && profileData.departments) {
        profileData.department_name = profileData.departments.name;
      }
      return profileData as Profile;
    } catch (e) {
      console.error('Fetch profile exception:', e);
      return null;
    }
  }, []);

  // Simple Tab Visibility Reload Logic
  useEffect(() => {
    // 1. Mark the current time as the "last reload" on initial mount
    if (!sessionStorage.getItem('last_visibility_reload')) {
      sessionStorage.setItem('last_visibility_reload', Date.now().toString());
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const lastReloadStr = sessionStorage.getItem('last_visibility_reload');
        const lastReload = lastReloadStr ? parseInt(lastReloadStr, 10) : 0;
        const now = Date.now();

        if (now - lastReload > 1000) {
          console.log('[AuthContext] Tab became visible/focused, triggering silent background refresh...');
          sessionStorage.setItem('last_visibility_reload', now.toString());
          setVisibilityCounter(prev => prev + 1);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      console.log('[AuthContext] Initializing Auth...');

      // Safety timeout: Auth must not block the app forever
      const initTimeout = setTimeout(() => {
        setLoading(prev => {
          if (prev) {
            console.warn('[AuthContext] Auth initialization timed out (15s). Proceeding with current state.');
            return false;
          }
          return prev;
        });
      }, 15000);

      try {
        const { supabaseUrl } = getSupabaseConfig();
        console.log('[AuthContext] Supabase Client URL:', supabaseUrl);
        console.log('[AuthContext] Fetching initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[AuthContext] getSession Error:', error);
          throw error;
        }

        if (session?.user) {
          console.log('[AuthContext] Session confirmed for:', session.user.email, 'ID:', session.user.id);
          setUser(session.user);
          const p = await fetchProfile(session.user.id);
          console.log('[AuthContext] Profile fetch result:', p ? 'Success' : 'Null/Failed');
          setProfile(p);
        } else {
          console.log('[AuthContext] No initial session found in cookies/storage.');
          setUser(null);
          setProfile(null);
        }
      } catch (e: any) {
        console.error('[AuthContext] Initialization Crash:', e.message);
      } finally {
        clearTimeout(initTimeout);
        console.log('[AuthContext] Initialization complete. Loading -> false');
        setLoading(false);
      }
    };

    initAuth();

    // 2. Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AuthContext] Auth State Change:', event);
      if (session?.user) {
        setUser(session.user);
        if (!profile || profile.id !== session.user.id) {
          console.log('[AuthContext] Fetching profile for user...', session.user.id);
          const p = await fetchProfile(session.user.id);
          if (!p) {
            console.warn('[AuthContext] User has no profile record. Continuing without profile state.');
          }
          setProfile(p);
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

  // Presence / Single Session Logic
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('kanban_session_id');
      if (saved) return saved;
      const id = generateUUID();
      sessionStorage.setItem('kanban_session_id', id);
      return id;
    }
    return 'init';
  });
  const presenceChannel = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
        presenceChannel.current = null;
      }
      return;
    }

    const channelName = `presence:sessions:${user.id}`;
    const myOnlineAt = Date.now();

    // Create new channel
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: sessionId,
        },
      },
    });

    presenceChannel.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const allSessions: any[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => allSessions.push(p));
        });

        const GRACE_PERIOD_MS = 5000;
        const newerSession = allSessions.find(s =>
          s.session_id !== sessionId &&
          s.online_at > (myOnlineAt + GRACE_PERIOD_MS)
        );

        if (newerSession) {
          console.warn('Another newer session detected. Reason: Multiple active tabs or devices.');
          supabase.auth.signOut().then(() => {
            setUser(null);
            setProfile(null);
            window.location.href = '/login?reason=multiple_sessions';
          });
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            session_id: sessionId,
            online_at: myOnlineAt,
            device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
          });
        }
      });

    return () => {
      if (presenceChannel.current) {
        supabase.removeChannel(presenceChannel.current);
      }
    };
  }, [user, sessionId]);

  const signOut = async () => {
    if (presenceChannel.current) {
      await supabase.removeChannel(presenceChannel.current);
      presenceChannel.current = null;
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin' || isSuperuserEmail(user?.email);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (!error) {
      setProfile(data as Profile);
    }
    return { data, error };
  };

  const updatePassword = async (newPassword: string) => {
    return supabase.auth.updateUser({ password: newPassword });
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      isAdmin,
      refreshProfile,
      updateProfile,
      updatePassword,
      visibilityCounter
    }}>
      {children}
    </AuthContext.Provider>
  );
};
