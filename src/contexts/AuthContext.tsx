'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { AuthModel } from 'pocketbase';
import { pb } from '@/lib/pocketbase';

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
    // Sync initial state on mount (client-only)
    setUser(pb.authStore.model);
    setLoading(false);

    // Subscribe to changes
    const unsub = pb.authStore.onChange((token, model) => {
      setUser(model);
    });

    return () => {
      unsub();
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
