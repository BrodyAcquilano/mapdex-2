/*
Redirect.jsx
Handles email verification from email links.

Flow:

* Email link → /redirect?token=...
* Shows loading spinner
* Calls backend verify
* Shows notification
*logout of existing sessions
* Redirects to login or register
  */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function VerifyEmailRedirect({ system, authApi }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    // ───────── No token ─────────
    if (!token) {
      system.notify("Invalid verification link. Please register again.");
      navigate("/register", { replace: true });
      return;
    }

    const run = async () => {
      system.startLoading("Verifying email...");

      // Always clear session first
      try {
        await authApi.logout();
      } catch {
        // ignore failure — session may not exist
      }

      const result = await authApi.verifyEmail(token);

      system.notify(result.message);

      if (result.success) {
        navigate("/login", { replace: true });
      } else {
        navigate("/register", { replace: true });
      }

      system.stopLoading();
    };

    run();
  }, []);

  return null;
}