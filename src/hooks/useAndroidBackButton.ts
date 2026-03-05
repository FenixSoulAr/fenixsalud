import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isAndroidNative } from "@/utils/platform";

/**
 * Handles Android hardware/gesture back button via @capacitor/app.
 * - If there's navigation history → go back.
 * - If on root "/" → double-tap to exit pattern.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastBackPress = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);

  useEffect(() => {
    if (!isAndroidNative) return;

    let cleanup: (() => void) | undefined;

    // Dynamic import so web builds never pull in native plugin
    import("@capacitor/app").then(({ App }) => {
      const listener = App.addListener("backButton", ({ canGoBack }) => {
        // If there's a dialog/modal open, let the browser handle it
        const openDialog = document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]'
        );
        if (openDialog) {
          // Press Escape to close dialog
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          return;
        }

        // If browser history can go back AND we're not at root
        if (canGoBack && location.pathname !== "/") {
          navigate(-1);
          return;
        }

        // At root — double-tap to exit
        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          // Second press within 2s → exit
          App.exitApp();
        } else {
          lastBackPress.current = now;
          setShowExitToast(true);
          setTimeout(() => setShowExitToast(false), 2000);
        }
      });

      listener.then((handle) => {
        cleanup = () => handle.remove();
      });
    });

    return () => {
      cleanup?.();
    };
  }, [navigate, location.pathname]);

  return { showExitToast };
}
