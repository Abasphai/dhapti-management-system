import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError, SESSION_EXPIRED_EVENT, TOKEN_KEY, USER_KEY } from "@/lib/api";

export type AuthRole =
  | "STUDENT"
  | "TEACHER"
  | "ADMIN"
  | "DEPARTMENT_ADMIN"
  | "EXAM_ADMIN"
  | "CERTIFICATE_ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  role: AuthRole;
  portal: "student" | "teacher" | "admin";
  status: string;
  permissions?: string[];
  profile: Record<string, unknown> | null;
  departmentId?: string | null;
  department?: { id: string; name: string; code: string } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    expectedRole: AuthRole
  ) => Promise<AuthUser>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => Boolean(token));

  const persist = useCallback(
    (nextToken: string | null, nextUser: AuthUser | null) => {
      setToken(nextToken);
      setUser(nextUser);
      try {
        if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
        else localStorage.removeItem(TOKEN_KEY);
        if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
        else localStorage.removeItem(USER_KEY);
      } catch {
        /* ignore private-mode / quota errors */
      }
    },
    []
  );

  const refreshMe = useCallback(async () => {
    let hasToken = false;
    try {
      hasToken = Boolean(localStorage.getItem(TOKEN_KEY));
    } catch {
      hasToken = false;
    }
    if (!hasToken) {
      setLoading(false);
      return;
    }
    try {
      const me = await api<AuthUser>("/auth/me");
      if (me.status !== "ACTIVE") {
        persist(null, null);
        return;
      }
      let storedToken: string | null = null;
      try {
        storedToken = localStorage.getItem(TOKEN_KEY);
      } catch {
        storedToken = null;
      }
      persist(storedToken, me);
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.status === 401 || err.status === 403)
      ) {
        persist(null, null);
      }
    } finally {
      setLoading(false);
    }
  }, [persist]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  /** Keep React auth state in sync when API interceptor clears an expired JWT. */
  useEffect(() => {
    const onExpired = () => {
      setToken(null);
      setUser(null);
      setLoading(false);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(
    async (email: string, password: string, expectedRole: AuthRole) => {
      const data = await api<{ token: string; user: AuthUser }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password, expectedRole }),
        }
      );
      if (data.user.status !== "ACTIVE") {
        throw new ApiError(401, "Account is inactive or suspended", "UNAUTHORIZED");
      }
      // Normalize portal for department / exam admins (backend maps them to admin portal)
      const nextUser: AuthUser = {
        ...data.user,
        portal:
          data.user.portal === "admin" ||
          data.user.role === "DEPARTMENT_ADMIN" ||
          data.user.role === "EXAM_ADMIN" ||
          data.user.role === "CERTIFICATE_ADMIN"
            ? "admin"
            : data.user.portal,
      };
      persist(data.token, nextUser);
      return nextUser;
    },
    [persist]
  );

  const logout = useCallback(() => {
    // Best-effort server notify (stateless JWT); always clear client session
    void api("/auth/logout", { method: "POST" }).catch(() => undefined);
    persist(null, null);
  }, [persist]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshMe,
      isAuthenticated: Boolean(token && user && user.status === "ACTIVE"),
    }),
    [user, token, loading, login, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const SAFE_AUTH: AuthContextValue = {
  user: null,
  token: null,
  loading: false,
  login: async () => {
    throw new Error("Auth is not available");
  },
  logout: () => undefined,
  refreshMe: async () => undefined,
  isAuthenticated: false,
};

export function useAuth() {
  return useContext(AuthContext) ?? SAFE_AUTH;
}
