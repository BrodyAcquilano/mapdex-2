// App.jsx

import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useSystem } from "./system/SystemProvider";
import { authApi } from "./api/authApi";

import MainAppAdapter from "./workspace/MainAppAdapter";
import Landing from "./auth/pages/Landing";
import VerifyEmailRedirect from "./auth/pages/VerifyEmailRedirect";
import Login from "./auth/pages/Login";
import Register from "./auth/pages/Register";
import ResetPasswordRequest from "./auth/pages/ResetPasswordRequest";
import ResetPassword from "./auth/pages/ResetPassword";

import ProtectedRoute from "./auth/guards/ProtectedRoute";
import PublicOnlyRoute from "./auth/guards/PublicOnlyRoute";

import VoiceButton from "./system/voice/ui/VoiceButton";
import HelpButton from "./system/voice/ui/HelpButton";
import VoiceCommandModal from "./system/voice/ui/VoiceCommandModal";

import ToastMessage from "./system/notifications/ToastMessage";
import ToastConfirm from "./system/notifications/ToastConfirm";
import ScreenReaderAnnouncer from "./system/notifications/ScreenReaderAnnouncer";
import LoadingSpinner from "./system/loading/LoadingSpinner";

function App() {
  const system = useSystem();
  const location = useLocation();

  const { registerVoiceCommands, registerKeyboardCommands, voiceUiStyle } =
    system;

  useEffect(() => {
    const cleanupVoice = registerVoiceCommands("global");
    const cleanupKeyboard = registerKeyboardCommands("globalKeyboardCommands");

    return () => {
      cleanupVoice?.();
      cleanupKeyboard?.();
    };
  }, [registerVoiceCommands, registerKeyboardCommands]);

  let defaultVoicePosition = "auth";

  if (location.pathname.startsWith("/app/viewer")) {
    defaultVoicePosition = "viewer";
  } else if (location.pathname.startsWith("/app/editor")) {
    defaultVoicePosition = "editor";
  } else if (location.pathname.startsWith("/app/analysis")) {
    defaultVoicePosition = "analysis";
  } else if (location.pathname.startsWith("/app/projects")) {
    defaultVoicePosition = "projects";
  } else if (location.pathname.startsWith("/app/community")) {
    defaultVoicePosition = "community";
  } else if (location.pathname.startsWith("/app/schema")) {
    defaultVoicePosition = "schema";
  } else if (location.pathname.startsWith("/app/account")) {
    defaultVoicePosition = "account";
  }

  const voicePosition =
    voiceUiStyle?.voicePositionOverride || defaultVoicePosition;

  const helpPosition =
    voiceUiStyle?.helpPositionOverride || defaultVoicePosition;

  const hasBottomUI = voiceUiStyle?.hasBottomUI || false;

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <PublicOnlyRoute system={system} authApi={authApi}>
              <Landing system={system} />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PublicOnlyRoute system={system} authApi={authApi}>
              <Login system={system} authApi={authApi} />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicOnlyRoute system={system} authApi={authApi}>
              <Register system={system} authApi={authApi} />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/verify-email-redirect"
          element={<VerifyEmailRedirect system={system} authApi={authApi} />}
        />

        <Route
          path="/reset-password-request"
          element={
            <PublicOnlyRoute system={system} authApi={authApi}>
              <ResetPasswordRequest system={system} authApi={authApi} />
            </PublicOnlyRoute>
          }
        />

        <Route
          path="/reset-password"
          element={<ResetPassword system={system} authApi={authApi} />}
        />

        <Route
          path="/app/*"
          element={
            <ProtectedRoute system={system} authApi={authApi}>
              <MainAppAdapter system={system} authApi={authApi} />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <VoiceButton
        system={system}
        position={voicePosition}
        hasBottomUI={hasBottomUI}
      />

      <HelpButton
        position={helpPosition}
        hasBottomUI={hasBottomUI}
        onClick={() => system.setIsVoiceHelpOpen(true)}
      />

      {system.isVoiceHelpOpen && (
        <VoiceCommandModal
          system={system}
          onClose={() => system.setIsVoiceHelpOpen(false)}
        />
      )}

      <ScreenReaderAnnouncer message={system.activeAnnouncement} />

      <div className="toast-container">
        {system.toasts.map((toast) => (
          <ToastMessage key={toast.id} message={toast.message} />
        ))}
      </div>

      {system.confirmState && (
        <ToastConfirm
          system={system}
          message={system.confirmState.message}
          confirmText={system.confirmState.confirmText}
          cancelText={system.confirmState.cancelText}
          onConfirm={() => system.handleConfirm(true)}
          onCancel={() => system.handleConfirm(false)}
        />
      )}

      {system.loadingState && (
        <LoadingSpinner text={system.loadingState.text} />
      )}
    </>
  );
}

export default App;
