import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkReceiptPayload } from '../work-receipt-email.ts';

test('monta o aviso com quem submeteu e os autores, sem repetir e-mails', () => {
    const payload = buildWorkReceiptPayload({
        titulo: '  Estudo X ',
        remetenteEmail: 'Ana@Example.com',
        autores: [
            { nome: 'Ana Souza', email: 'ana@example.com' },
            { nome: ' Bruno Lima ', email: 'bruno@example.com' },
            { nome: 'Ana Souza', email: '' },
            { nome: 'Sem arroba', email: 'invalido' },
            null,
        ],
    });

    assert.deepEqual(payload, {
        titulo: 'Estudo X',
        autores: ['Ana Souza', 'Bruno Lima', 'Sem arroba'],
        destinatarios: ['ana@example.com', 'bruno@example.com'],
    });
});

test('não gera aviso sem título ou sem destinatário', () => {
    assert.equal(buildWorkReceiptPayload({ titulo: '', remetenteEmail: 'a@b.com', autores: [] }), null);
    assert.equal(buildWorkReceiptPayload({ titulo: 'X', remetenteEmail: undefined, autores: 'x' }), null);
});
