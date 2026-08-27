'use client';

import { useEffect } from 'react';

export default function AsaasCustomerSyncRetry() {
    useEffect(() => {
        const controller = new AbortController();
        void fetch('/api/post/syncAsaasCustomer', {
            method: 'POST',
            signal: controller.signal,
            keepalive: true,
        }).catch(() => undefined);
        return () => controller.abort();
    }, []);

    return null;
}
