"use client";

import type { UserCart } from '@/types/firestore';

export interface CartEntry {
  serviceId: string;
  quantity: number;
}

const CART_STORAGE_KEY = 'screenplayproUserCart';

export const getCartEntries = (): CartEntry[] => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }
  const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
  if (storedCart) {
    try {
      const parsedCart = JSON.parse(storedCart);
      return Array.isArray(parsedCart) ? parsedCart : [];
    } catch (e) {
      console.error("Error parsing cart from localStorage", e);
      return [];
    }
  }
  return [];
};

export const saveCartEntries = (entries: CartEntry[]): void => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(entries));
};

export const syncCartOnLogin = async (userId: string): Promise<void> => {
    if (!userId) return;
    const localCart = getCartEntries();

    try {
        const res = await fetch(`/api/db/collections?name=userCarts&id=${userId}`);
        const json = await res.json();
        const firestoreCartItems: CartEntry[] = (json.success && json.data) ? (json.data as UserCart).items : [];

        const mergedCartMap = new Map<string, number>();

        firestoreCartItems.forEach(item => {
            mergedCartMap.set(item.serviceId, item.quantity);
        });
        localCart.forEach(item => {
            mergedCartMap.set(item.serviceId, item.quantity);
        });

        const mergedCart: CartEntry[] = Array.from(mergedCartMap.entries()).map(([serviceId, quantity]) => ({ serviceId, quantity }));
        
        saveCartEntries(mergedCart); 
        await syncCartToFirestore(userId, mergedCart);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }));
        }

    } catch (error) {
        console.error("Error during cart sync on login:", error);
    }
};

export const syncCartToFirestore = async (userId: string, cartEntries: CartEntry[]) => {
  if (!userId) return;

  if (cartEntries.length > 0) {
    try {
      await fetch('/api/db/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionName: 'userCarts',
          id: userId,
          data: {
            userId: userId,
            items: cartEntries,
            updatedAt: new Date().toISOString(),
            marketingStatus: { reminderSent: false }
          }
        })
      });
    } catch (error) {
      console.error("Error syncing cart to MySQL:", error);
    }
  } else {
    try {
      await fetch(`/api/db/collections?name=userCarts&id=${userId}`, { method: 'DELETE' });
    } catch (error) {
      console.error("Error deleting empty cart from MySQL:", error);
    }
  }
};

export const saveActiveCheckoutEntries = (entries: CartEntry[]): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem('screenplayproActiveCheckoutItems', JSON.stringify(entries));
  }
};

export const getActiveCheckoutEntries = (): CartEntry[] => {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return [];
  }
  const storedActive = window.localStorage.getItem('screenplayproActiveCheckoutItems');
  if (storedActive) {
    try {
      const parsed = JSON.parse(storedActive);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : getCartEntries();
    } catch (e) {
      return getCartEntries();
    }
  }
  return getCartEntries();
};

export const removeCheckedOutItemsFromCart = async (userId: string | undefined): Promise<void> => {
  const allCart = getCartEntries();
  const checkedOut = getActiveCheckoutEntries();
  const remaining = allCart.filter(item => !checkedOut.some(c => c.serviceId === item.serviceId));
  
  saveCartEntries(remaining);
  if (userId) {
    await syncCartToFirestore(userId, remaining);
  }
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('screenplayproActiveCheckoutItems');
    window.localStorage.removeItem('screenplayproActiveCheckoutCategory');
    window.localStorage.removeItem('screenplayproActiveCheckoutCategoryName');
    window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY }));
  }
};
