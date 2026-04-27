import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

/**
 * Wires Clerk's session token into the shared API client so every request
 * carries `Authorization: Bearer <token>`. Mounted once near the root when
 * Clerk mode is active. In owner mode this component is never rendered, so
 * the API client sends no auth header (the backend owner-mode fallback
 * handles it).
 */
export function ClerkAuthBridge() {
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => {
      setAuthTokenGetter(null);
    };
  }, [getToken, isLoaded]);

  return null;
}
