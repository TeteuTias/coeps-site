import { isIP } from 'node:net';

export function getPaymentRemoteIp(request: Request): string | null {
    const candidates = [
        ...(request.headers.get('x-forwarded-for') || '').split(','),
        request.headers.get('x-real-ip') || '',
    ];
    const remoteIp = candidates
        .map((value) => value.trim())
        .find((value) => isIP(value) > 0);

    if (remoteIp) return remoteIp;
    return process.env.NODE_ENV === 'production' ? null : '127.0.0.1';
}
