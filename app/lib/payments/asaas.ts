type AsaasHeaderOptions = {
    json?: boolean;
    apiUrl?: string;
};

export function asaasUserAgent(apiUrl = process.env.ASAAS_API_URL): string {
    const version = process.env.npm_package_version || '0.1.0';
    const environment = String(apiUrl || '').toLowerCase().includes('sandbox')
        ? 'sandbox'
        : 'production';
    return `COEPS-Site/${version} (Node.js; ${environment})`;
}

export function asaasRequestHeaders(
    apiKey: string,
    options: AsaasHeaderOptions = {},
): Record<string, string> {
    return {
        accept: 'application/json',
        'content-type': 'application/json',
        access_token: apiKey,
        'User-Agent': asaasUserAgent(options.apiUrl),
    };
}

export function isAsaasRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}
