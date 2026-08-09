export function isPaymentSalesEnabled(
    environment: Record<string, string | undefined> = process.env,
): boolean {
    const configured = environment.PAYMENT_SALES_ENABLED;
    if (configured == null || configured.trim() === '') return true;
    return !['false', '0', 'off', 'no'].includes(configured.trim().toLowerCase());
}

export function paymentSalesPausedResponse(): Response {
    return Response.json(
        {
            error: 'payment_sales_paused',
            message: 'A criação de novas cobranças está temporariamente pausada.',
        },
        { status: 503 },
    );
}
