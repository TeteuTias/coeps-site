export type RegistrationGateInput = {
    path: string;
    profileComplete: boolean;
    paymentConfirmed: boolean;
    confirmationSeen: boolean;
    remoteWorkAccessActive?: boolean;
    remoteWorkAreaAccess?: boolean;
    remoteWorkSubmissionAllowed?: boolean;
    healthProfileMissing?: boolean;
};

type RegistrationUser = {
    isPos_registration?: unknown;
    informacoes_usuario?: {
        nome?: unknown;
        cpf?: unknown;
        numero_telefone?: unknown;
        profissao?: unknown;
        matricula_municipio?: unknown;
    } | null;
    pagamento?: {
        situacao?: unknown;
        tipo_pagamento?: unknown;
    } | null;
} | null | undefined;

export const HEALTH_PROFILE_PATH = '/painel/completarCadastro';

const filled = (value: unknown) => typeof value === 'string' && value.trim() !== '';

// Inscrito como profissional da saúde antes da nova política: falta profissão ou matrícula do município.
export function isHealthProfileMissing(user: RegistrationUser): boolean {
    if (user?.pagamento?.situacao !== 1 || user.pagamento.tipo_pagamento !== 'profissional_saude') return false;
    return !filled(user.informacoes_usuario?.profissao) || !filled(user.informacoes_usuario?.matricula_municipio);
}

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
    remoteWorkAccessActive = false,
    remoteWorkAreaAccess = remoteWorkAccessActive,
    remoteWorkSubmissionAllowed = remoteWorkAccessActive,
    healthProfileMissing = false,
}: RegistrationGateInput): string | null {
    const isPayments = path.startsWith('/pagamentos');
    const isProfile = path === '/painel/dadosIniciais';
    const isCertificates = path.startsWith('/painel/certificados');
    const isConfirmation = path.startsWith('/painel/suaInscricaoFoiConfirmada');
    const isRemoteWorkArea = path.startsWith('/painel/trabalhos');
    const isNewWorkSubmission = path.startsWith('/painel/trabalhos/enviarTrabalho');

    if (remoteWorkAreaAccess && isRemoteWorkArea) {
        if (isNewWorkSubmission && !remoteWorkSubmissionAllowed && !paymentConfirmed) {
            return '/painel/trabalhos';
        }
        return null;
    }

    if (remoteWorkAreaAccess && !paymentConfirmed) {
        if (isPayments) return null;
        return '/painel/trabalhos';
    }

    if (!profileComplete) {
        if (!paymentConfirmed) return isPayments ? null : '/pagamentos';
        return isProfile ? null : '/painel/dadosIniciais';
    }

    const isHealthProfile = path === HEALTH_PROFILE_PATH;
    if (paymentConfirmed && healthProfileMissing) return isHealthProfile ? null : HEALTH_PROFILE_PATH;
    if (isHealthProfile) return '/painel';

    if (!paymentConfirmed && !isCertificates && !isPayments) return '/pagamentos';
    if (paymentConfirmed && !confirmationSeen && !isConfirmation) {
        return '/painel/suaInscricaoFoiConfirmada';
    }
    if (confirmationSeen && isConfirmation) return '/painel';
    return null;
}
