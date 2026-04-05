import { useAppStore } from "@/stores/app-store";
import { useBatchStore } from "@/stores/batch-store";
import { useGateStore } from "@/stores/gate-store";

/**
 * Reset all Zustand stores to initial state between tests.
 */
export function resetAllStores() {
  useAppStore.setState({
    step: "idle",
    uploadId: null,
    originalImage: null,
    selectedTypeId: null,
    processedResult: null,
    history: [],
    error: null,
  });

  useBatchStore.getState().reset();
  useGateStore.setState({ selectedConfigId: null });
}
