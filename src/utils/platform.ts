import { Capacitor } from "@capacitor/core";

// Primary detection via @capacitor/core
const capIsNative = Capacitor.isNativePlatform();
const capPlatform = Capacitor.getPlatform();

// Fallback: read the global bridge directly (covers timing/version-mismatch edge cases)
// deno-lint-ignore no-explicit-any
const bridge = typeof window !== "undefined" ? (window as any).Capacitor : null;
const bridgeIsNative: boolean = bridge?.isNativePlatform === true;
const bridgePlatform: string = bridge?.getPlatform?.() ?? bridge?.platform ?? "web";

/** True when running inside a Capacitor native shell (Android / iOS) */
export const isNative = capIsNative || bridgeIsNative;

/** The platform string: 'android' | 'ios' | 'web' */
export const platform = capIsNative ? capPlatform : bridgePlatform;

/** True only when running as a native Android APK */
export const isAndroidNative = isNative && platform === "android";

/** True only when running as a native iOS app */
export const isIOSNative = isNative && platform === "ios";

// Debug — visible in Android logcat / Chrome remote devtools
console.log("[Platform]", {
  capIsNative,
  capPlatform,
  bridgeIsNative,
  bridgePlatform,
  isNative,
  platform,
  isAndroidNative,
});
