import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ system, authApi, children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    let isMounted = true;

    system.startLoading("Verifying session...");

    const checkAuth = async () => {
      try {
        const { data } = await authApi.me();

        if (!isMounted) return;

        setIsAuthenticated(data?.authenticated === true);
      } catch {
        if (isMounted) {
          setIsAuthenticated(false); 
        }
      } finally {
        if (isMounted) {
          system.stopLoading();
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [system.startLoading, system.stopLoading, authApi]);

  if (isAuthenticated === null) return null;

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}