import { IPayment } from "../payments/payment.t"

export interface IUser {
    "_id": string & { readonly __brand: 'ObjectId' },
    "id_api": string,
    "isPos_registration": boolean,
    "informacoes_usuario": {
        "cpf"?: string,
        "numero_telefone"?: string,
        "nome"?: string,
        "email"?: string,
        "data_criacao"?: string | Date, // ele retorna do db como string, mas é guardado como data => "2024-08-13T20:57:40.256Z",
        "titulo_honorario"?: string,
        "país"?: string,
        "cidade"?: string,
        "data_nascimento"?: string, // "YYYY-MM-DD" -> Melhor para MongoDb
        "onde_conheceu"?: string,
        "situacao_academica"?: string,
        "curso"?: string,
        "ano_conclusao"?: number,
        "semestre_conclusao"?: number,
        "endereco"?: {
            "postalCode"?: string,
            "address"?: string,
            "addressNumber"?: string,
            "complement"?: string,
            "province"?: string
        }
    },
    "pagamento": IPayment,
    "consentimentos"?: {
        "lgpd"?: {
            "aceito": boolean,
            "aceitoEm": string | Date,
            "versao": string
        }
    },
    "integracoes"?: {
        "asaas"?: {
            "customerSync"?: {
                "status": "SYNCED" | "PENDING" | "PROCESSING" | "REVIEW_REQUIRED",
                "attempts"?: number,
                "updatedAt"?: string | Date,
                "lastSyncedAt"?: string | Date,
                "nextAttemptAt"?: string | Date,
                "lastError"?: string | null
            }
        }
    },
    // "teste": true isso pode estar em alguns, mas é só para identificação diretamente no mongodb!!!
}
