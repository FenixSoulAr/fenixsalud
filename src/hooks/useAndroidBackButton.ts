import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isAndroidNative } from "@/utils/platform";

/**
 * Handles Android hardware/gesture back button via @capacitor/app.
 * - If there's a modal open → close it (Escape).
 * - If there's navigation history → go back.
 * - If on root "/" → show exit confirmation dialog.
 */
export function useAndroidBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showExitDialog, setShowExitDialog] = useState(false);

  useEffect(() => {
    if (!isAndroidNative) return;

    let cleanup: (() => void) | undefined;

    import("@capacitor/app").then(({ App }) => {
      const listener = App.addListener("backButton", ({ canGoBack }) => {
        // 1) If a dialog/modal is open, close it
        const openDialog = document.querySelector(
          '[data-state="open"][role="dialog"], [data-state="open"][role="alertdialog"]'
        );
        if (openDialog) {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          return;
        }

        // 2) If browser history can go back AND not at root → navigate back
        if (canGoBack && location.pathname !== "/") {
          navigate(-1);
          return;
        }

        // 3) At root → show exit confirmation dialog
        setShowExitDialog(true);
      });

      listener.then((handle) => {
        cleanup = () => handle.remove();
      });
    });

    return () => {
      cleanup?.();
    };
  }, [navigate, location.pathname]);

  const confirmExit = () => {
    setShowExitDialog(false);
    import("@capacitor/app").then(({ App }) => App.exitApp());
  };

  const cancelExit = () => {
    setShowExitDialog(false);
  };

  return { showExitDialog, confirmExit, cancelExit };
}
