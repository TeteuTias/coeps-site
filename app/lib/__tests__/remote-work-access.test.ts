import assert from 'node:assert/strict';
import test from 'node:test';
import {
    isRemoteMunicipalityBlocked,
    municipalityMatchesUf,
    normalizePaymentProductType,
    normalizeMunicipalityName,
    remoteWorkActiveKey,
    REMOTE_WORK_PRICE_CENTS,
    resolveBrazilianMunicipality,
    toPublicRemoteWorkAccess,
    validateRemoteMunicipality,
} from '../remote-work-access.ts';

const blocked = [
    ['3103504', 'MG', 'Araguari'], ['3170206', 'MG', 'Uberlândia'], ['3169604', 'MG', 'Tupaciguara'],
    ['3145000', 'MG', 'Nova Ponte'], ['3143104', 'MG', 'Monte Carmelo'], ['3157708', 'MG', 'Santa Juliana'],
    ['3149804', 'MG', 'Perdizes'], ['3148103', 'MG', 'Patrocínio'], ['3119302', 'MG', 'Coromandel'],
    ['3115805', 'MG', 'Centralina'], ['3111804', 'MG', 'Canápolis'], ['3142809', 'MG', 'Monte Alegre de Minas'],
    ['3152808', 'MG', 'Prata'], ['3170107', 'MG', 'Uberaba'], ['5205109', 'GO', 'Catalão'], ['5210109', 'GO', 'Ipameri'],
    ['5204508', 'GO', 'Caldas Novas'], ['5213806', 'GO', 'Morrinhos'], ['5203906', 'GO', 'Buriti Alegre'], ['5211503', 'GO', 'Itumbiara'],
] as const;

test('blocks every configured municipality regardless of accents and case', () => {
    for (const [code, uf, name] of blocked) {
        assert.equal(isRemoteMunicipalityBlocked({ code, uf, name: 'Nome vindo do IBGE' }), true, code);
        assert.equal(isRemoteMunicipalityBlocked({ uf: uf.toLowerCase(), name }), true, `${name}/${uf}`);
    }
    assert.equal(isRemoteMunicipalityBlocked({ uf: 'MG', name: 'uberlandia' }), true);
    assert.equal(isRemoteMunicipalityBlocked({ uf: 'GO', name: 'BERITI ALEGRE' }), false);
    assert.equal(normalizeMunicipalityName('  Canápolis  '), 'CANAPOLIS');
});

test('allows another valid municipality and rejects malformed values', () => {
    assert.equal(validateRemoteMunicipality({ code: '3106200', name: 'Belo Horizonte', uf: 'MG' }).ok, true);
    assert.equal(validateRemoteMunicipality({ code: '123', name: 'Belo Horizonte', uf: 'MG' }).ok, false);
    assert.equal(validateRemoteMunicipality({ code: '3170206', name: 'Uberlândia', uf: 'MG' }).ok, false);
});

test('resolves the official municipality and UF pair', async () => {
    const fetchMock = async () => new Response(JSON.stringify({
        nome: 'Belo Horizonte',
        microrregiao: { mesorregiao: { UF: { sigla: 'MG' } } },
    }), { status: 200 });
    const city = await resolveBrazilianMunicipality('3106200', fetchMock as typeof fetch);
    assert.deepEqual(city, { code: '3106200', name: 'Belo Horizonte', uf: 'MG' });
    assert.equal(municipalityMatchesUf(city!, 'MG'), true);
    assert.equal(municipalityMatchesUf(city!, 'SP'), false);
    assert.equal(municipalityMatchesUf(city!, 'XX-invalid'), false);
});

test('fixa o preço no servidor e usa chave ativa exclusiva do produto remoto', () => {
    assert.equal(REMOTE_WORK_PRICE_CENTS, 6000);
    assert.equal(
        remoteWorkActiveKey('COEPS-2026', 'user-1'),
        'COEPS-2026:user-1:remote-work-access',
    );
    assert.notEqual(remoteWorkActiveKey('COEPS-2026', 'user-1'), 'COEPS-2026:user-1:ticket');
    assert.equal(normalizePaymentProductType(undefined), 'ticket');
    assert.equal(normalizePaymentProductType(null), 'ticket');
    assert.equal(normalizePaymentProductType('remote-work-access'), 'remote-work-access');
});

test('remove a chave privada e o hash ao serializar o acesso para o usuário', () => {
    const value = toPublicRemoteWorkAccess({
        _id: 'access-1',
        editionId: 'COEPS-2026',
        municipalityCode: '3106200',
        municipalityName: 'Belo Horizonte',
        uf: 'MG',
        status: 'ACTIVE',
        proofReviewStatus: 'PENDING',
        proof: {
            proofId: 'proof-1',
            objectKey: 'private/never-expose.pdf',
            sha256: 'never-expose',
            originalName: 'conta.pdf',
            mimeType: 'application/pdf',
            size: 128,
            uploadedAt: new Date('2026-09-10T12:00:00.000Z'),
        },
        updatedAt: new Date('2026-09-10T12:00:00.000Z'),
    } as never);
    assert.ok(value);
    assert.doesNotMatch(JSON.stringify(value), /objectKey|sha256|never-expose/);
});
