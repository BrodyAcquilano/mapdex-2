import { useEffect, useState } from "react";
import MainApp from "./MainApp";
import { accountsApi } from "../api/accountsApi.js";

export default function MainAppAdapter({ system, authApi }) {
  const [user, setUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const {
          success,
          data: apiResponse,
          message,
        } = await accountsApi.getUser();

        if (success && apiResponse) {
          if (apiResponse.voicePlan) {
            system.setVoicePlan(apiResponse.voicePlan);
          }

          setUser({
            userName: apiResponse.userName || "",
            voicePlan: apiResponse.voicePlan || "free",
            subscriptionTier: apiResponse.subscriptionTier || "free",
            userColorTheme: apiResponse.userColorTheme || "green",
            followers: Array.isArray(apiResponse.followers)
              ? apiResponse.followers
              : [],
            following: Array.isArray(apiResponse.following)
              ? apiResponse.following
              : [],
            blockedUsers: Array.isArray(apiResponse.blockedUsers)
              ? apiResponse.blockedUsers
              : [],
          });
        } else {
          console.error("User load failed:", message);
        }
      } finally {
        setIsBootstrapping(false);
      }
    };

    loadUser();
  }, []);

  if (isBootstrapping) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <MainApp
      system={system}
      authApi={authApi}
      accountsApi={accountsApi}
      user={user}
      setUser={setUser}
    />
  );
}
