// Regras do cadastro pós-pagamento (fora nome/CPF/CEP/número, que ficam em normalizePaymentCustomerInput).
// Devolve a mensagem do primeiro campo inválido para o usuário saber exatamente o que corrigir.

export type RegistrationProfile = {
    phone: string;
    address: string;
    province: string;
    cityName: string;
    country: string;
    birthDate: string;
    referral: string;
    academicStatus: 'estudante' | 'formado';
    course: string;
    profession: string;
    municipalRegistration: string;
    graduationYear: number;
    graduationSemester: number;
};

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function dateIsValid(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function municipalRegistrationError(value: string, required: boolean): string | null {
    if (required && !value) return 'Número da matrícula do município: campo obrigatório.';
    if (value.length > 50) return 'Número da matrícula do município: use no máximo 50 caracteres.';
    return null;
}

// Complemento pedido a quem já está inscrito como profissional da saúde (só profissão e matrícula).
export function validateHealthProfileComplement(
    data: Record<string, unknown>,
): { ok: true; value: { profession: string; municipalRegistration: string } } | { ok: false; message: string } {
    const profession = text(data.profissao);
    const municipalRegistration = text(data.matricula_municipio);
    if (!profession) return { ok: false, message: 'Profissão: informe sua profissão.' };
    const registrationError = municipalRegistrationError(municipalRegistration, true);
    if (registrationError) return { ok: false, message: registrationError };
    return { ok: true, value: { profession, municipalRegistration } };
}

export function validateRegistrationProfile(
    data: Record<string, unknown>,
): { ok: true; value: RegistrationProfile } | { ok: false; message: string } {
    const phone = String(data.numero_telefone ?? '').replace(/\D/g, '');
    const address = text(data.address);
    const province = text(data.province);
    const cityName = text(data.cidade);
    const country = text(data.pais) || 'Brasil';
    const birthDate = text(data.data_nascimento);
    const referral = text(data.onde_conheceu);
    const academicStatus = text(data.situacao_academica);
    const course = text(data.curso);
    const profession = text(data.profissao);
    const municipalRegistration = text(data.matricula_municipio);
    const graduationYear = Number(data.ano_conclusao);
    const graduationSemester = Number(data.semestre_conclusao);
    const yearLabel = academicStatus === 'formado' ? 'Ano de formação' : 'Ano de conclusão';

    const fail = (message: string) => ({ ok: false as const, message });
    if (phone.length < 10 || phone.length > 11) return fail('Telefone: informe DDD + número (10 ou 11 dígitos).');
    if (!dateIsValid(birthDate)) return fail('Data de nascimento: informe uma data válida.');
    if (!address) return fail('Rua / Logradouro: campo obrigatório.');
    if (!province) return fail('Bairro / Província: campo obrigatório.');
    if (!cityName) return fail('Nome da cidade: campo obrigatório.');
    if (!referral) return fail('Onde conheceu o evento: campo obrigatório.');
    if (academicStatus !== 'estudante' && academicStatus !== 'formado') {
        return fail('Situação acadêmica: selecione "Sou Estudante" ou "Já sou Formado".');
    }
    if (!course) return fail('Curso: campo obrigatório.');
    if (academicStatus === 'formado' && !profession) return fail('Profissão: informe sua profissão.');
    const registrationError = municipalRegistrationError(municipalRegistration, academicStatus === 'formado');
    if (registrationError) return fail(registrationError);
    if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100) {
        return fail(`${yearLabel}: use 4 números entre 1900 e 2100 (ex: 2024).`);
    }
    if (graduationSemester !== 1 && graduationSemester !== 2) return fail('Semestre: selecione o 1º ou o 2º semestre.');

    return {
        ok: true,
        value: {
            phone,
            address,
            province,
            cityName,
            country,
            birthDate,
            referral,
            academicStatus,
            course,
            profession: academicStatus === 'formado' ? profession : '',
            municipalRegistration: academicStatus === 'formado' ? municipalRegistration : '',
            graduationYear,
            graduationSemester,
        },
    };
}
