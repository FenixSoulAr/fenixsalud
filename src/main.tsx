import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Friendly Wellness UI - v1.2 (resilient auth + pull-to-refresh fix)
createRoot(document.getElementById("root")!).render(<App />);
