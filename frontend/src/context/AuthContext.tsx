"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getMe,
  loginWithEmail,
  loginWithGoogle,
  signupWithEmail,
  type AuthUser,
} from "@/services/api";

interface AuthContextValue {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  initialized: boolean;
  getDefaultDashboardPath: () => string;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogleToken: (idToken: string) => Promise<AuthUser>;
  signup: (
    name: string,
    email: string,
    phoneNumber: string,
    password: string,
    role: "user" | "authority",
  ) => Promise<AuthUser>;
  logout: () => void;
}

const AUTH_STORAGE_KEY = "findme-auth-user";
const AUTH_TOKEN_STORAGE_KEY = "findme-auth-token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedUser = sessionStorage.getItem(AUTH_STORAGE_KEY);
      const storedToken = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

      if (storedUser && storedToken) {
        try {
          const parsedUser = JSON.parse(storedUser) as AuthUser;
          setUser(parsedUser);
          setToken(storedToken);
          void getMe(storedToken).catch(() => {
            sessionStorage.removeItem(AUTH_STORAGE_KEY);
            sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            setUser(null);
            setToken(null);
          });
        } catch {
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
      }

      // Remove legacy persistent auth keys from older builds.
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);

      setInitialized(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const persistAuth = useCallback((nextUser: AuthUser, nextToken: string) => {
    setUser(nextUser);
    setToken(nextToken);
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginWithEmail({ email, password });
      persistAuth(response.user, response.access_token);
      return response.user;
    },
    [persistAuth],
  );

  const loginWithGoogleToken = useCallback(
    async (idToken: string) => {
      const response = await loginWithGoogle(idToken);
      persistAuth(response.user, response.access_token);
      return response.user;
    },
    [persistAuth],
  );

  const signup = useCallback(
    async (
      name: string,
      email: string,
      phoneNumber: string,
      password: string,
      role: "user" | "authority",
    ) => {
      const response = await signupWithEmail({
        name,
        email,
        phone_number: phoneNumber,
        password,
        role,
      });
      persistAuth(response.user, response.access_token);
      return response.user;
    },
    [persistAuth],
  );

  const getDefaultDashboardPath = useCallback(
    () => (user?.role === "authority" ? "/admin" : "/dashboard"),
    [user?.role],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(user),
      user,
      token,
      initialized,
      getDefaultDashboardPath,
      login,
      loginWithGoogleToken,
      signup,
      logout,
    }),
    [
      getDefaultDashboardPath,
      initialized,
      loginWithGoogleToken,
      logout,
      signup,
      token,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
