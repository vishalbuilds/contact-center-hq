import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "cc-hq-user-settings";
export const STORED_TZ = "America/New_York"; // DynamoDB always stores times in EST

const UserSettingsContext = createContext(null);

export function UserSettingsProvider({ children }) {
  const [userTz, setUserTzState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).userTz;
    } catch { /* ignore corrupt localStorage */ }
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  const setUserTz = (tz) => {
    setUserTzState(tz);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ userTz: tz }));
    } catch { /* ignore storage quota errors */ }
  };

  return (
    <UserSettingsContext.Provider value={{ userTz, setUserTz, storedTz: STORED_TZ }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUserSettings() {
  const ctx = useContext(UserSettingsContext);
  // Graceful fallback — no conversion when used outside provider
  if (!ctx) return { userTz: STORED_TZ, setUserTz: () => {}, storedTz: STORED_TZ };
  return ctx;
}
