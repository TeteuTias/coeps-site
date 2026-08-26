import test from 'node:test';
import assert from 'node:assert/strict';
import {
    createAsaasCheckoutWithCustomerCityRepair,
    isAsaasMissingCustomerCityError,
    normalizeAsaasCustomerAddress,
    repairAsaasCustomerCity,
} from '../customer-provisioning.ts';

const apiUrl = 'https://api-sandbox.asaas.com/v3';
const apiKey = 'test-key';
const customerId = 'cus_test';
const checkout = { customer: customerId, externalReference: 'purchase_test' };
const address = {
    postalCode: '38.440-000',
    address: 'Rua de Teste',
    addressNumber: 10,
    province: 'Centro',
    complement: 'Não informado',
};
const missingCityBody = {
    errors: [
        {
            code: 'invalid_object',
            description: 'O campo city deve existir para o customer informado.',
        },
    ],
};

test('detecta somente o invalid_object de city ausente no customer', () => {
    assert.equal(isAsaasMissingCustomerCityError(missingCityBody), true);
    assert.equal(isAsaasMissingCustomerCityError({
        errors: [{ code: 'invalid_object', description: 'O campo email deve existir.' }],
    }), false);
    assert.equal(isAsaasMissingCustomerCityError({
        errors: [{ code: 'invalid_city', description: missingCityBody.errors[0].description }],
    }), false);
});

test('normaliza o endereço sem enviar nome textual como city', () => {
    const normalized = normalizeAsaasCustomerAddress({ ...address, city: 'Araguari' });
    assert.deepEqual(normalized, {
        address: 'Rua de Teste',
        addressNumber: '10',
        province: 'Centro',
        postalCode: '38440000',
    });
    assert.equal('city' in normalized, false);
});

test('cliente válido cria um único checkout sem atualizar customer', async () => {
    const methods: string[] = [];
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(init?.method || 'GET');
        return Response.json({ id: 'checkout_ok', link: 'https://example.invalid/checkout' });
    }) as typeof fetch;

    const result = await createAsaasCheckoutWithCustomerCityRepair({
        customerId,
        address,
        apiUrl,
        apiKey,
        checkout,
        fetchImpl: fetchMock,
    });

    assert.equal(result.kind, 'response');
    assert.deepEqual(methods, ['POST']);
    if (result.kind === 'response') assert.equal(result.repairAttempted, false);
});

test('city ausente atualiza o mesmo customer e repete o checkout uma vez', async () => {
    const methods: string[] = [];
    let checkoutCalls = 0;
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || 'GET';
        methods.push(method);
        if (method === 'PUT') {
            const payload = JSON.parse(String(init?.body));
            assert.equal(payload.postalCode, '38440000');
            assert.equal('city' in payload, false);
            return Response.json({ id: customerId, city: 12345 });
        }
        checkoutCalls += 1;
        return checkoutCalls === 1
            ? Response.json(missingCityBody, { status: 400 })
            : Response.json({ id: 'checkout_recovered', link: 'https://example.invalid/checkout' });
    }) as typeof fetch;

    const result = await createAsaasCheckoutWithCustomerCityRepair({
        customerId,
        address,
        apiUrl,
        apiKey,
        checkout,
        fetchImpl: fetchMock,
    });

    assert.equal(result.kind, 'response');
    assert.deepEqual(methods, ['POST', 'PUT', 'POST']);
    if (result.kind === 'response') {
        assert.equal(result.response.ok, true);
        assert.equal(result.repairAttempted, true);
    }
});

test('confirma city por GET quando o PUT não a devolve', async () => {
    const methods: string[] = [];
    let checkoutCalls = 0;
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || 'GET';
        methods.push(method);
        if (method === 'PUT') return Response.json({ id: customerId });
        if (method === 'GET') return Response.json({ id: customerId, city: 54321 });
        checkoutCalls += 1;
        return checkoutCalls === 1
            ? Response.json(missingCityBody, { status: 400 })
            : Response.json({ id: 'checkout_confirmed', link: 'https://example.invalid/checkout' });
    }) as typeof fetch;

    const result = await createAsaasCheckoutWithCustomerCityRepair({
        customerId,
        address,
        apiUrl,
        apiKey,
        checkout,
        fetchImpl: fetchMock,
    });

    assert.equal(result.kind, 'response');
    assert.deepEqual(methods, ['POST', 'PUT', 'GET', 'POST']);
});

test('CEP inválido falha antes de atualizar customer', async () => {
    let calls = 0;
    const fetchMock = (async () => {
        calls += 1;
        return Response.json({ city: 12345 });
    }) as typeof fetch;

    const result = await repairAsaasCustomerCity({
        customerId,
        address: { ...address, postalCode: '123' },
        apiUrl,
        apiKey,
        fetchImpl: fetchMock,
    });

    assert.deepEqual(result, {
        ok: false,
        code: 'CUSTOMER_ADDRESS_INVALID',
        status: 422,
    });
    assert.equal(calls, 0);
});

test('erro diferente não atualiza customer nem repete checkout', async () => {
    const methods: string[] = [];
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        methods.push(init?.method || 'GET');
        return Response.json({
            errors: [{ code: 'invalid_object', description: 'O campo email deve existir.' }],
        }, { status: 400 });
    }) as typeof fetch;

    const result = await createAsaasCheckoutWithCustomerCityRepair({
        customerId,
        address,
        apiUrl,
        apiKey,
        checkout,
        fetchImpl: fetchMock,
    });

    assert.equal(result.kind, 'response');
    assert.deepEqual(methods, ['POST']);
});

test('timeout ao reparar não inicia a segunda criação de checkout', async () => {
    const methods: string[] = [];
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || 'GET';
        methods.push(method);
        if (method === 'PUT') throw new Error('timeout simulado');
        return Response.json(missingCityBody, { status: 400 });
    }) as typeof fetch;

    const result = await createAsaasCheckoutWithCustomerCityRepair({
        customerId,
        address,
        apiUrl,
        apiKey,
        checkout,
        fetchImpl: fetchMock,
    });

    assert.equal(result.kind, 'repair_failed');
    assert.deepEqual(methods, ['POST', 'PUT']);
    if (result.kind === 'repair_failed') assert.equal(result.repair.status, 503);
});

test('uma segunda resposta de city ausente não provoca terceira tentativa', async () => {
    const methods: string[] = [];
    const fetchMock = (async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method || 'GET';
        methods.push(method);
        return method === 'PUT'
            ? Response.json({ id: customerId, city: 12345 })
            : Response.json(missingCityBody, { status: 400 });
    }) as typeof fetch;

    const result = await createAsaasCheckoutWithCustomerCityRepair({
        customerId,
        address,
        apiUrl,
        apiKey,
        checkout,
        fetchImpl: fetchMock,
    });

    assert.equal(result.kind, 'response');
    assert.deepEqual(methods, ['POST', 'PUT', 'POST']);
    if (result.kind === 'response') assert.equal(result.repairAttempted, true);
});
