export type RegistrationGateInput = {
    path: string;
    profileComplete: boolean;
    paymentConfirmed: boolean;
    confirmationSeen: boolean;
};

type RegistrationUser = {
    isPos_registration?: unknown;
    informacoes_usuario?: {
        nome?: unknown;
        cpf?: unknown;
        numero_telefone?: unknown;
    } | null;
} | null | undefined;

export function isRegistrationProfileComplete(user: RegistrationUser): boolean {
    if (!user?.isPos_registration) return false;

    const profile = user.informacoes_usuario;
    const name = typeof profile?.nome === 'string' ? profile.nome.trim() : '';
    const cpf = String(profile?.cpf ?? '').replace(/\D/g, '');
    const phone = String(profile?.numero_telefone ?? '').replace(/\D/g, '');

    return name.length >= 5 && [11, 14].includes(cpf.length) && phone.length >= 10;
}

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
