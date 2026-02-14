import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize a string for accent/case-insensitive sorting */
export function normalizeForSort(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Sort an array of objects by a string key, ignoring accents and case */
export function sortByName<T>(items: T[], key: keyof T): T[] {
  return [...items].sort((a, b) =>
    normalizeForSort(String(a[key] || "")).localeCompare(normalizeForSort(String(b[key] || "")))
  );
}
