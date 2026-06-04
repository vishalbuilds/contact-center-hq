import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/me/v1/profile", { signal: controller.signal })
      .then(async (r) => {
        if (r.ok) return r.json();
        const message = await r.text().catch(() => "");
        return Promise.reject({ status: r.status, message });
      })
      .then(setUser)
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setUser(null);
        setAuthError(
          err?.status ? err : { status: 0, message: "Network error" },
        );
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  // Stable references — only recreated when user changes (once, on load).
  // Without useCallback these are new functions every render, causing every
  // consumer to re-render even when nothing actually changed.
  const accessLevel = useCallback(
    (resource) => {
      if (!resource || !user?.resources?.includes(resource)) return null;
      return user.accessLevel; // "admin" | "viewer"
    },
    [user],
  );

  const canRead = useCallback(
    (resource) => accessLevel(resource) !== null,
    [accessLevel],
  );
  const canWrite = useCallback(
    (resource) => accessLevel(resource) === "admin",
    [accessLevel],
  );

  // Stable context object — without useMemo this is a new object every render,
  // which breaks React's bailout and re-renders all consumers unnecessarily.
  const value = useMemo(
    () => ({ user, loading, authError, accessLevel, canRead, canWrite }),
    [user, loading, authError, accessLevel, canRead, canWrite],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
