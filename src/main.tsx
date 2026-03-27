import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global visualViewport listener — keeps CSS variable in sync with
// the actual visible area so modals/drawers recover full height
// after the virtual keyboard closes on Android.
if (window.visualViewport) {
  const updateViewportHeight = () => {
    document.documentElement.style.setProperty(
      "--visual-viewport-height",
      `${window.visualViewport!.height}px`
    );
  };
  updateViewportHeight();
  window.visualViewport.addEventListener("resize", updateViewportHeight);
}

createRoot(document.getElementById("root")!).render(<App />);
