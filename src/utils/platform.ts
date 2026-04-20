import { Capacitor } from "@capacitor/core";

/** Evaluates platform detection at call time (safe against timing issues) */
export function getIsAndroidNative(): boolean {
  try {
    const native = Capacitor.isNativePlatform();
    const plat = Capacitor.getPlatform();
    if (native && plat === "android") return true;
    // Bridge fallback — isNativePlatform is a FUNCTION, not a boolean
    const bridge = typeof window !== "undefined" ? (window as any).Capacitor : null;
    const bridgeNative = typeof bridge?.isNativePlatform === "function"
      ? bridge.isNativePlatform()
      : false;
    const bridgePlatform = bridge?.getPlatform?.() ?? bridge?.platform ?? "web";
    return bridgeNative && bridgePlatform === "android";
  } catch {
    return false;
  }
}

/** Static snapshot at module load — use getIsAndroidNative() for reliable checks */
export const isAndroidNative = getIsAndroidNative();
export const isNative = isAndroidNative;
export const platform = isAndroidNative ? "android" : "web";
export const isIOSNative = false;

console.log("[Platform] isAndroidNative:", isAndroidNative, "| Capacitor.getPlatform():", Capacitor.getPlatform());
