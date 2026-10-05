import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely converts various timestamp formats to milliseconds.
 * Handles serialized plain objects, ISO strings, Date objects, and numbers.
 */
export function getTimestampMillis(ts: any): number {
  if (!ts) return 0;
  
  if (typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  
  if (typeof ts === 'object') {
    if (ts.seconds !== undefined) {
      return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1000000;
    }
    if (ts._seconds !== undefined) {
      return ts._seconds * 1000 + (ts._nanoseconds || 0) / 1000000;
    }
    if (ts instanceof Date) {
      return ts.getTime();
    }
  }
  
  if (typeof ts === 'string') {
    const date = new Date(ts);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }
  
  if (typeof ts === 'number') {
    return ts;
  }
  
  return 0;
}
