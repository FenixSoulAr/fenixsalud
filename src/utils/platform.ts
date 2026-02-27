import { Capacitor } from "@capacitor/core";

/** True when running inside a Capacitor native shell (Android / iOS) */
export const isNative = Capacitor.isNativePlatform();

/** The platform string: 'android' | 'ios' | 'web' */
export const platform = Capacitor.getPlatform();

/** True only when running as a native Android APK */
export const isAndroidNative = isNative && platform === "android";

/** True only when running as a native iOS app */
export const isIOSNative = isNative && platform === "ios";
