'use client';

import { useEffect } from 'react';
import { useUser } from '@/lib/auth0-client';
import { fetchJsonWithTimeout } from '@/lib/client/fetchWithTimeout';
import { getConfirmedPurchaseValue } from '@/lib/meta-pixel';

const META_PIXEL_ID = '2392093421199963';
const META_PIXEL_RETRY_DELAY_MS = 250;
const META_PIXEL_MAX_ATTEMPTS = 20;
const PAYMENT_HISTORY_TIMEOUT_MS = 5_000;
const sentInThisDocument = new Set();

function getSessionKey(editionId, userId) {
  return `meta-purchase:${META_PIXEL_ID}:${editionId}:${userId}`;
}

function wasSentInThisSession(key) {
  if (sentInThisDocument.has(key)) return true;

  try {
    return window.sessionStorage.getItem(key) === 'sent';
  } catch {
    return false;
  }
}

function markAsSent(key) {
  sentInThisDocument.add(key);

  try {
    window.sessionStorage.setItem(key, 'sent');
  } catch {
    // The in-memory guard still prevents duplicates in the current document.
  }
}

export default function MetaPurchaseTracker({ editionId }) {
  const { user, isLoading } = useUser();
  const userId = typeof user?.sub === 'string' ? user.sub : null;

  useEffect(() => {
    if (isLoading || !userId) return undefined;

    const sessionKey = getSessionKey(editionId, userId);
    if (wasSentInThisSession(sessionKey)) return undefined;

    let cancelled = false;
    let attempts = 0;
    let retryTimer;
    let purchaseValue = null;

    const trackPurchase = () => {
      if (cancelled || wasSentInThisSession(sessionKey)) return;

      if (typeof window.fbq !== 'function') {
        attempts += 1;
        if (attempts < META_PIXEL_MAX_ATTEMPTS) {
          retryTimer = window.setTimeout(trackPurchase, META_PIXEL_RETRY_DELAY_MS);
        }
        return;
      }

      try {
        if (purchaseValue === null) {
          window.fbq('track', 'Purchase');
        } else {
          window.fbq('track', 'Purchase', {
            value: purchaseValue,
            currency: 'BRL',
          });
        }
        markAsSent(sessionKey);
      } catch {
        // Tracking failures must never interrupt the confirmation page.
      }
    };

    const loadPurchaseAndTrack = async () => {
      try {
        const history = await fetchJsonWithTimeout(
          '/api/get/usuariosPagamentos',
          { method: 'GET', credentials: 'same-origin', cache: 'no-store' },
          PAYMENT_HISTORY_TIMEOUT_MS,
        );
        if (history?.data?.pagamento?.situacao !== 1) return;
        purchaseValue = getConfirmedPurchaseValue(history, editionId);
      } catch {
        // Preserve the basic conversion count when enrichment is unavailable.
      }

      if (!cancelled) trackPurchase();
    };

    void loadPurchaseAndTrack();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [editionId, isLoading, userId]);

  return null;
}
