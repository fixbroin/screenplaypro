// src/lib/guestIdManager.ts
import { nanoid } from 'nanoid';

const GUEST_ID_KEY = 'sp_guest_id';

export function getGuestId(): string {
  if (typeof window === 'undefined') return '';
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = `guest_${nanoid(12)}`;
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

export function clearGuestId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GUEST_ID_KEY);
}
