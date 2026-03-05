import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { isAndroidNative } from "@/utils/platform";

/**
 * Renders a toast-like message when user presses back at root screen.
 * Mount this inside <BrowserRouter>.
 */
export function AndroidBackHandler() {
  const { showExitToast } = useAndroidBackButton();

  if (!isAndroidNative || !showExitToast) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-foreground text-background px-5 py-2.5 rounded-full text-sm font-medium shadow-lg">
        Presioná atrás de nuevo para salir
      </div>
    </div>
  );
}
