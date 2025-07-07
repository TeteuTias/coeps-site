export interface IPaymentConfig {
    "_id": string & { readonly __brand: 'ObjectId' },
    "dataInit": "",
    "dataEnd": "",
    "parcelamentos": {
        "codigo": number,
        "valorCadaParcela": number,
        "totalParcelas": number
    }[],
    "nome": string, // exemplo => "Terceiro Lote - COEPS",
    "valorAVista": number
}


export interface IPayment {
    "_id": string & { readonly __brand: 'ObjectId' },
    "situacao": number, // mostra se está pago ou não => 0, 1 ou 2 onde 0 não há pagamento criado, 1 pago, 2 pagamento criado e esperando confirmação
    "lista_pagamentos": {
        "object": string,
        "id": string, // exemplo => "pay_e4qzehxllm4ep78p" NAO É OBJECT ID
        "dateCreated": "2024-09-10",
        "customer": "cus_000006200822",
        "paymentLink": string | null,
        "value": number,
        "netValue": number,
        "originalValue": number | null,
        "interestValue": number | null,
        "description": string,
        "billingType": string,
        "pixTransaction": string | null,
        "status": string | "PAYMENT_OVERDUE",
        "dueDate": string, // exemplo => "2024-09-10",
        "originalDueDate": string, //"2024-09-10",
        "paymentDate": string | null,
        "clientPaymentDate": string | null,
        "installmentNumber": string | null,
        "invoiceUrl": string,
        "invoiceNumber": string,
        "externalReference": string | null,
        "deleted": boolean,
        "anticipated": boolean,
        "anticipable": boolean,
        "creditDate": string | null,
        "estimatedCreditDate": string | null,
        "transactionReceiptUrl": string | null,
        "nossoNumero": string, // exemplo => "10187602"
        "bankSlipUrl": string, "https://sandbox.asaas.com/b/pdf/e4qzehxllm4ep78p",
        "lastInvoiceViewedDate": string | null,
        "lastBankSlipViewedDate": string | null,
        "discount": {
            "value": number, //0,
            "limitDate": string | null,
            "dueDateLimitDays": number,
            "type": string, // exemplo => "PERCENTAGE"
        },
        "fine": {
            "value": number,
            "type": string // "FIXED"
        },
        "interest": {
            "value": number, //0
            "type": string, // exemplo => "PERCENTAGE"
        },
        "postalService": boolean,
        "custody": any | null,
        "refunds": any | null,
        "_webhook": {
            "id": number, //exemplo => "evt_15e444ff9b9ab9ec29294aa1abe68025&723192187",
            "event": string, //exemplo => "PAYMENT_CONFIRMED",
            "dateCreated": string, //exemplo => "2024-09-10 17:33:38",
            "payment": {
                "object": string, //exemplo => "payment",
                "id": string, //exemplo => "pay_kyi0avmjfavn2mr3",
                "dateCreated": string, //exemplo => "2024-09-10",
                "customer": string, //exemplo =>  "cus_000006200822",
                "installment": string, //exemplo => "ba344679-fcfc-462b-9652-5bca2ff7a0db",
                "paymentLink": string | null,
                "value": number //63,
                "netValue": number,//exemplo => 61.28,
                "originalValue": string | number | null,
                "interestValue": string | number | null,
                "description": string, //exemplo => "Parcela 3 de 3.",
                "billingType": string, //exemplo => "CREDIT_CARD",
                "confirmedDate": string, //exemplo => "2024-09-10",
                "creditCard": {
                    "creditCardNumber": string, //exemplo => "0110",
                    "creditCardBrand": string, //exemplo => "MASTERCARD"
                },
                "pixTransaction": string | number | null,
                "status": string, //exemplo => "CONFIRMED",
                "dueDate": string, //exemplo => "2024-11-10",
                "originalDueDate": string, //exemplo => "2024-11-10",
                "paymentDate": string | null,
                "clientPaymentDate": string,
                "installmentNumber": number,
                "invoiceUrl": string, //exemplo => "https://www.asaas.com/i/kyi0avmjfavn2mr3",
                "invoiceNumber": string, //exemplo => "06454484",
                "externalReference": string | null | number,
                "deleted": boolean,
                "anticipated": boolean,
                "anticipable": boolean,
                "creditDate": string, //exemplo => "2024-12-16",
                "estimatedCreditDate": string, //exemplo => "2024-12-16",
                "transactionReceiptUrl": string, //exemplo => "https://www.asaas.com/comprovantes/7367524436420187",
                "nossoNumero": string | null,
                "bankSlipUrl": string | null,
                "lastInvoiceViewedDate": string | null,
                "lastBankSlipViewedDate": string | null,
                "discount": {
                    "value": number,
                    "limitDate": string | null,
                    "dueDateLimitDays": number,
                    "type": string, //exemplo => "FIXED"
                },
                "fine": {
                    "value": number,
                    "type": string, //exemplo => "FIXED"
                },
                "interest": {
                    "value": number,
                    "type": string, //exemplo => "PERCENTAGE"
                },
                "postalService": boolean,
                "custody": string | number | boolean | null,
                "refunds": string | number | boolean | null
            }
        }[],
        "_type": string, //exemplo => "ticket",
        "_id": string & { readonly __brand: 'ObjectId' },
        "_eventID": string & { readonly __brand: 'ObjectId' },
    }[],
    "situacao_animacao": boolean,
    "tipo_pagamento": string // pode ser assas | organizador e ???

}

/* outros exemplos, se forem pertinentes adiciono na interface
{
                "id": "evt_15e444ff9b9ab9ec29294aa1abe68025&723192187",
                "event": "PAYMENT_OVERDUE",
                "dateCreated": "2024-09-10 17:33:38",
                "payment": {
                    "object": "payment",
                    "id": "pay_kyi0avmjfavn2mr3",
                    "dateCreated": "2024-09-10",
                    "customer": "cus_000006200822",
                    "installment": "ba344679-fcfc-462b-9652-5bca2ff7a0db",
                    "paymentLink": null,
                    "value": 63,
                    "netValue": 61.28,
                    "originalValue": null,
                    "interestValue": null,
                    "description": "Parcela 3 de 3.",
                    "billingType": "CREDIT_CARD",
                    "confirmedDate": "2024-09-10",
                    "creditCard": {
                        "creditCardNumber": "0110",
                        "creditCardBrand": "MASTERCARD"
                    },
                    "pixTransaction": null,
                    "status": "CONFIRMED",
                    "dueDate": "2024-11-10",
                    "originalDueDate": "2024-11-10",
                    "paymentDate": null,
                    "clientPaymentDate": "2024-09-10",
                    "installmentNumber": 3,
                    "invoiceUrl": "https://www.asaas.com/i/kyi0avmjfavn2mr3",
                    "invoiceNumber": "06454484",
                    "externalReference": null,
                    "deleted": false,
                    "anticipated": false,
                    "anticipable": false,
                    "creditDate": "2024-12-16",
                    "estimatedCreditDate": "2024-12-16",
                    "transactionReceiptUrl": "https://www.asaas.com/comprovantes/7367524436420187",
                    "nossoNumero": null,
                    "bankSlipUrl": null,
                    "lastInvoiceViewedDate": null,
                    "lastBankSlipViewedDate": null,
                    "discount": {
                        "value": 0,
                        "limitDate": null,
                        "dueDateLimitDays": 0,
                        "type": "FIXED"
                    },
                    "fine": {
                        "value": 0,
                        "type": "FIXED"
                    },
                    "interest": {
                        "value": 0,
                        "type": "PERCENTAGE"
                    },
                    "postalService": false,
                    "custody": null,
                    "refunds": null
                }
            },
            {
                "id": "evt_15e444ff9b9ab9ec29294aa1abe68025&723192187",
                "event": "PAYMENT_OVERDUE",
                "dateCreated": "2024-09-10 17:33:38",
                "payment": {
                    "object": "payment",
                    "id": "pay_kyi0avmjfavn2mr3",
                    "dateCreated": "2024-09-10",
                    "customer": "cus_000006200822",
                    "installment": "ba344679-fcfc-462b-9652-5bca2ff7a0db",
                    "paymentLink": null,
                    "value": 63,
                    "netValue": 61.28,
                    "originalValue": null,
                    "interestValue": null,
                    "description": "Parcela 3 de 3.",
                    "billingType": "CREDIT_CARD",
                    "confirmedDate": "2024-09-10",
                    "creditCard": {
                        "creditCardNumber": "0110",
                        "creditCardBrand": "MASTERCARD"
                    },
                    "pixTransaction": null,
                    "status": "CONFIRMED",
                    "dueDate": "2024-11-10",
                    "originalDueDate": "2024-11-10",
                    "paymentDate": null,
                    "clientPaymentDate": "2024-09-10",
                    "installmentNumber": 3,
                    "invoiceUrl": "https://www.asaas.com/i/kyi0avmjfavn2mr3",
                    "invoiceNumber": "06454484",
                    "externalReference": null,
                    "deleted": false,
                    "anticipated": false,
                    "anticipable": false,
                    "creditDate": "2024-12-16",
                    "estimatedCreditDate": "2024-12-16",
                    "transactionReceiptUrl": "https://www.asaas.com/comprovantes/7367524436420187",
                    "nossoNumero": null,
                    "bankSlipUrl": null,
                    "lastInvoiceViewedDate": null,
                    "lastBankSlipViewedDate": null,
                    "discount": {
                        "value": 0,
                        "limitDate": null,
                        "dueDateLimitDays": 0,
                        "type": "FIXED"
                    },
                    "fine": {
                        "value": 0,
                        "type": "FIXED"
                    },
                    "interest": {
                        "value": 0,
                        "type": "PERCENTAGE"
                    },
                    "postalService": false,
                    "custody": null,
                    "refunds": null
                }
            },
            {
                "id": "evt_15e444ff9b9ab9ec29294aa1abe68025&723192187",
                "event": "PAYMENT_OVERDUE",
                "dateCreated": "2024-09-10 17:33:38",
                "payment": {
                    "object": "payment",
                    "id": "pay_kyi0avmjfavn2mr3",
                    "dateCreated": "2024-09-10",
                    "customer": "cus_000006200822",
                    "installment": "ba344679-fcfc-462b-9652-5bca2ff7a0db",
                    "paymentLink": null,
                    "value": 63,
                    "netValue": 61.28,
                    "originalValue": null,
                    "interestValue": null,
                    "description": "Parcela 3 de 3.",
                    "billingType": "CREDIT_CARD",
                    "confirmedDate": "2024-09-10",
                    "creditCard": {
                        "creditCardNumber": "0110",
                        "creditCardBrand": "MASTERCARD"
                    },
                    "pixTransaction": null,
                    "status": "CONFIRMED",
                    "dueDate": "2024-11-10",
                    "originalDueDate": "2024-11-10",
                    "paymentDate": null,
                    "clientPaymentDate": "2024-09-10",
                    "installmentNumber": 3,
                    "invoiceUrl": "https://www.asaas.com/i/kyi0avmjfavn2mr3",
                    "invoiceNumber": "06454484",
                    "externalReference": null,
                    "deleted": false,
                    "anticipated": false,
                    "anticipable": false,
                    "creditDate": "2024-12-16",
                    "estimatedCreditDate": "2024-12-16",
                    "transactionReceiptUrl": "https://www.asaas.com/comprovantes/7367524436420187",
                    "nossoNumero": null,
                    "bankSlipUrl": null,
                    "lastInvoiceViewedDate": null,
                    "lastBankSlipViewedDate": null,
                    "discount": {
                        "value": 0,
                        "limitDate": null,
                        "dueDateLimitDays": 0,
                        "type": "FIXED"
                    },
                    "fine": {
                        "value": 0,
                        "type": "FIXED"
                    },
                    "interest": {
                        "value": 0,
                        "type": "PERCENTAGE"
                    },
                    "postalService": false,
                    "custody": null,
                    "refunds": null
                }
            }
*/