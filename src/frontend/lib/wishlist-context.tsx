'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { carsApi, wishlistApi } from './api';

interface WishlistContextValue {
  ids: Set<string>;
  isWishlisted: (carId: string) => boolean;
  toggle: (carId: string) => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      return;
    }
    let active = true;
    wishlistApi
      .list()
      .then((res) => {
        if (active) setIds(new Set(res.data.map((c) => c.id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user]);

  const isWishlisted = useCallback((carId: string) => ids.has(carId), [ids]);

  // Optimistic — the heart flips instantly on click rather than waiting for
  // the round trip, since this is exactly the kind of rapid-fire interaction
  // (browsing many cars, tapping several hearts) that feels sluggish
  // otherwise. Rolled back to the pre-click state if the request fails.
  const toggle = useCallback(async (carId: string) => {
    const wasWishlisted = ids.has(carId);
    setIds((prev) => {
      const next = new Set(prev);
      if (wasWishlisted) next.delete(carId);
      else next.add(carId);
      return next;
    });
    try {
      const res = await carsApi.toggleWishlist(carId);
      setIds((prev) => {
        const next = new Set(prev);
        if (res.wishlisted) next.add(carId);
        else next.delete(carId);
        return next;
      });
    } catch {
      setIds((prev) => {
        const next = new Set(prev);
        if (wasWishlisted) next.add(carId);
        else next.delete(carId);
        return next;
      });
    }
  }, [ids]);

  return <WishlistContext.Provider value={{ ids, isWishlisted, toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
