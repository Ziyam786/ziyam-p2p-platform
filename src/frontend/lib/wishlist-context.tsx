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

  const toggle = useCallback(async (carId: string) => {
    const res = await carsApi.toggleWishlist(carId);
    setIds((prev) => {
      const next = new Set(prev);
      if (res.wishlisted) next.add(carId);
      else next.delete(carId);
      return next;
    });
  }, []);

  return <WishlistContext.Provider value={{ ids, isWishlisted, toggle }}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}
