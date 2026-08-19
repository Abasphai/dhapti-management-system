import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth, type AuthRole } from "@/context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles: AuthRole[];
  loginPath: string;
}

export function ProtectedRoute({
  allowedRoles,
  loginPath,
}: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] text-[#002147]">
        <p className="text-sm font-semibold tracking-wide">Loading portal…</p>
      </div>
    );
  }

  if (!isAuthenticated || !user || user.status !== "ACTIVE") {
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={`/${user.portal}/dashboard`} replace />;
  }

  return <Outlet />;
}
