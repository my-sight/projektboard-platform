'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
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

  // Presence / Single Session Logic
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('kanban_session_id');
      if (saved) return saved;
      const id = typeof crypto !== 'undefined' && crypto.randomUUID && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2);
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

        // SINGLE SESSION ENFORCEMENT
        // We only kill ourself if there is an OTHER session with a significantly NEWER timestamp.
        // ID check prevents self-logout after refresh (IDs persist in sessionStorage).
        // Grace period (5s) prevents logout on small clock skews or rapid refreshes.
        const GRACE_PERIOD_MS = 5000;
        const newerSession = allSessions.find(s =>
          s.session_id !== sessionId &&
          s.online_at > (myOnlineAt + GRACE_PERIOD_MS)
        );

        if (newerSession) {
          console.warn('Another newer session detected. Reason: Multiple active tabs or devices.', {
            myTime: myOnlineAt,
            otherTime: newerSession.online_at,
            diff: newerSession.online_at - myOnlineAt
          });

          // Enforce logout
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

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
