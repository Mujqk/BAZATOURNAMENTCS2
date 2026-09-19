import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Profile } from '../types/database.types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DEMO_ADMIN_PROFILE, DEMO_PLAYER_PROFILE } from '../lib/demoData';

interface AuthContextType {
  user: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  demoRole: 'admin' | 'player' | 'guest';
  loginWithDiscord: () => Promise<void>;
  logout: () => Promise<void>;
  switchDemoRole: (role: 'admin' | 'player' | 'guest') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [demoRole, setDemoRole] = useState<'admin' | 'player' | 'guest'>('admin');

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo Mode initial user
      const savedRole = localStorage.getItem('cs2_demo_role') as 'admin' | 'player' | 'guest';
      const activeRole = savedRole || 'admin';
      setDemoRole(activeRole);
      if (activeRole === 'admin') setUser(DEMO_ADMIN_PROFILE);
      else if (activeRole === 'player') setUser(DEMO_PLAYER_PROFILE);
      else setUser(null);
      setIsLoading(false);
      return;
    }

    // Live Supabase Auth
    async function initAuth() {
      if (!supabase) return;

      // Clean up URL if there were error params from a previous OAuth attempt
      if (window.location.search.includes('error=') || window.location.hash.includes('error=')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error fetching session:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadUserProfile(authUser: any) {
    if (!supabase || !authUser) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (!error && data) {
        setUser(data);
        return;
      }

      // Self-healing fallback: if profile record doesn't exist yet in public.profiles, create it
      const meta = authUser.user_metadata || {};
      const fallbackProfile = {
        id: authUser.id,
        discord_id: meta.provider_id || meta.sub || authUser.id,
        discord_username: meta.full_name || meta.name || meta.user_name || 'CS2 Player',
        avatar_url: meta.avatar_url || meta.picture || null,
        is_admin: false,
      };

      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert(fallbackProfile)
        .select()
        .single();

      if (!insertError && createdProfile) {
        setUser(createdProfile);
      } else {
        console.warn('Fallback profile creation notice:', insertError);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  }

  const loginWithDiscord = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: window.location.origin + window.location.pathname,
        },
      });
    } else {
      // In demo mode, log in as player or admin
      switchDemoRole('player');
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    if (!isSupabaseConfigured) {
      switchDemoRole('guest');
    }
  };

  const switchDemoRole = (role: 'admin' | 'player' | 'guest') => {
    setDemoRole(role);
    localStorage.setItem('cs2_demo_role', role);
    if (role === 'admin') setUser(DEMO_ADMIN_PROFILE);
    else if (role === 'player') setUser(DEMO_PLAYER_PROFILE);
    else setUser(null);
  };

  const isAdmin = Boolean(user?.is_admin);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        isDemoMode: !isSupabaseConfigured,
        demoRole,
        loginWithDiscord,
        logout,
        switchDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
