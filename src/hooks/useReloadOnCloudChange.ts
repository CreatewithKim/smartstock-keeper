import { useEffect } from "react";
import { onDataChanged } from "@/services/cloudSync";

/**
 * Re-runs the given loader whenever cloud sync emits a data-changed event
 * (after a pull from Supabase or after any local mutation).
 */
export function useReloadOnCloudChange(loader: () => void) {
  useEffect(() => {
    const off = onDataChanged(() => loader());
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
