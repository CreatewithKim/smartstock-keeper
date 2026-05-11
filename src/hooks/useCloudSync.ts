import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  pullFromCloud,
  pushAllLocal,
  subscribeRealtime,
} from "@/services/cloudSync";

/**
 * Wires up cross-device sync once a user is signed in:
 *  - On login / first online: backfill local data to cloud, then pull cloud -> local.
 *  - On `online` event: pull again so devices catch up after being offline.
 *  - On realtime postgres_changes: pull updated rows so the UI hot-reloads.
 */
export function useCloudSync() {
  const { user } = useAuth();
  const didInitialBackfill = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const run = async () => {
      try {
        // First time we see this user on this device: backfill any local-only data up to cloud.
        if (didInitialBackfill.current !== user.id) {
          didInitialBackfill.current = user.id;
          await pushAllLocal();
        }
        if (!cancelled) await pullFromCloud();
      } catch (e) {
        console.warn("[useCloudSync] initial sync failed:", e);
      }
    };
    run();

    const handleOnline = () => {
      pullFromCloud().catch((e) =>
        console.warn("[useCloudSync] online pull failed:", e),
      );
    };
    window.addEventListener("online", handleOnline);

    const unsubscribe = subscribeRealtime(user.id, () => {
      pullFromCloud().catch((e) =>
        console.warn("[useCloudSync] realtime pull failed:", e),
      );
    });

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);
      unsubscribe();
    };
  }, [user]);
}
