export type RegistrationGateInput = {
    path: string;
    profileComplete: boolean;
    paymentConfirmed: boolean;
    confirmationSeen: boolean;
};

export function getRegistrationRedirect({
    path,
    profileComplete,
    paymentConfirmed,
    confirmationSeen,
}: RegistrationGateInput): string | null {
    const isPayments = path.startsWith('/pagamentos');
    const isProfile = path === '/painel/dadosIniciais';
    const isCertificates = path.startsWith('/painel/certificados');
    const isConfirmation = path.startsWith('/painel/suaInscricaoFoiConfirmada');

    if (!profileComplete) {
        if (!paymentConfirmed) return isPayments ? null : '/pagamentos';
        return isProfile ? null : '/painel/dadosIniciais';
    }

    if (!paymentConfirmed && !isCertificates && !isPayments) return '/pagamentos';
    if (paymentConfirmed && !confirmationSeen && !isConfirmation) {
        return '/painel/suaInscricaoFoiConfirmada';
    }
    if (confirmationSeen && isConfirmation) return '/painel';
    return null;
}
