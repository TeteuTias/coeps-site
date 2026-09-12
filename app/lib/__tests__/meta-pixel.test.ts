import assert from 'node:assert/strict';
import test from 'node:test';
import { getConfirmedPurchaseValue } from '../meta-pixel.ts';

test('seleciona o pagamento confirmado da edição atual', () => {
  const value = getConfirmedPurchaseValue({
    data: {
      pagamento: {
        situacao: 1,
        lista_pagamentos: [
          { status: 'PAYMENT_CONFIRMED', value: 150, description: 'Inscrição CIEPS-2025' },
          { status: 'PAYMENT_CONFIRMED', value: 132.499, description: 'Inscrição CIEPS-2026' },
        ],
      },
    },
  }, 'CIEPS-2026');

  assert.equal(value, 132.5);
});

test('aceita o pagamento confirmado mais recente quando o legado não informa edição', () => {
  const value = getConfirmedPurchaseValue({
    data: {
      pagamento: {
        situacao: 1,
        lista_pagamentos: [
          { status: 'PAYMENT_CONFIRMED', value: 120, description: 'Inscrição' },
        ],
      },
    },
  }, 'CIEPS-2026');

  assert.equal(value, 120);
});

test('não retorna valor de usuário não pago ou de registro inválido', () => {
  assert.equal(getConfirmedPurchaseValue({
    data: {
      pagamento: {
        situacao: 0,
        lista_pagamentos: [
          { status: 'PAYMENT_CONFIRMED', value: 120, description: 'Inscrição CIEPS-2026' },
        ],
      },
    },
  }, 'CIEPS-2026'), null);

  assert.equal(getConfirmedPurchaseValue({
    data: {
      pagamento: {
        situacao: 1,
        lista_pagamentos: [
          { status: 'PENDING', value: 120, description: 'Inscrição CIEPS-2026' },
          { status: 'PAYMENT_CONFIRMED', value: -1, description: 'Inscrição CIEPS-2026' },
        ],
      },
    },
  }, 'CIEPS-2026'), null);
});
