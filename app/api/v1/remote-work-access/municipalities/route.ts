import { NextResponse } from 'next/server';
import { withApiAuthRequired } from '@/lib/auth0-compat';
import { isRemoteMunicipalityBlocked } from '@/lib/remote-work-access';

const VALID_UFS = new Set([
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

export const GET = withApiAuthRequired(async function GET(request: Request) {
    const uf = new URL(request.url).searchParams.get('uf')?.trim().toUpperCase() || '';
    if (!VALID_UFS.has(uf)) {
        return NextResponse.json(
            { error: 'invalid_uf', message: 'Selecione uma UF válida.' },
            { status: 400 },
        );
    }

    try {
        const response = await fetch(
            `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
            { cache: 'force-cache', next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8_000) },
        );
        if (!response.ok) throw new Error(`IBGE_${response.status}`);
        const payload = await response.json() as Array<{ id?: unknown; nome?: unknown }>;
        const municipalities = payload
            .map((item) => ({ code: String(item.id || ''), name: String(item.nome || ''), uf }))
            .filter((item) => /^\d{7}$/.test(item.code) && item.name)
            .map((item) => ({ ...item, remoteEligible: !isRemoteMunicipalityBlocked(item) }));
        return NextResponse.json({ municipalities });
    } catch (error) {
        console.error('Falha ao consultar municípios do IBGE:', error);
        return NextResponse.json(
            { error: 'municipality_service_unavailable', message: 'Não foi possível consultar os municípios.' },
            { status: 503 },
        );
    }
});
