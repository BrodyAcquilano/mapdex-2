// src/routes/PublicOnlyRoute.jsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";


export default function PublicOnlyRoute({ system, authApi, children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
    let isMounted = true;

    system.startLoading("Checking session...");

    const checkAuth = async () => {
      try {
        const { data } = await authApi.me();

        if (!isMounted) return;

        setIsAuthenticated(data?.authenticated === true);
      } catch {
        if (isMounted) {
          setIsAuthenticated(false); // handle 401 explicitly
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

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return children;
}