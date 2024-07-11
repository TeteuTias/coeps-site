import requests
import json
import random
import threading
import time
import string
def gerar_email_aleatoria(tamanho):
    letras = string.ascii_lowercase  # Todas as letras minúsculas do alfabeto
    palavra  = ''.join(random.choice(letras) for _ in range(tamanho))
    palavra2 = ''.join(random.choice(letras) for _ in range(tamanho))
    
    return palavra+"@"+palavra2+".com.br"

def gerar_numero_aleatorio():
    numero = ''.join(random.choices('0123456789', k=11))
    return numero
def gerar_numero_aleatorio_8():
    numero = ''.join(random.choices('0123456789', k=8))
    return numero
def enviarRequest(index, TYPE):
    TYPE = 'boleto' # so funfa com boleto por enquanto
    start_time = time.time()
    url  = "http://localhost:3000/api/payment/webhook/hook01"
    url2 = "http://localhost:3000/api/payment/webhook/hook02"

    id = gerar_numero_aleatorio()
    id_modificador = gerar_numero_aleatorio()
    code = gerar_numero_aleatorio()

    id_client_db = "668ef50cce62095db191c767"
    payload = {
      "type": 'credit_card',
      "documento": gerar_numero_aleatorio(),
      "email":gerar_email_aleatoria(8),
      "telefone":gerar_numero_aleatorio()
    }
    headers = {
      'aaa': 'aa',
      'Content-Type': 'application/json'
    }
    body = {}
    payload02 = {}
    if (TYPE == "credit_card"):
        body = {
  "id": "hook_5vJyV4mHGUpM83mw",
  "account": {
    "id": "acc_qANKDm9UBziNRxyb",
    "name": "Loja on-line  - test"
  },
  "type": "charge.created",
  "created_at": "2024-07-10T18:18:40.683Z",
  "data": {
    "id": "ch_ye51D9qcGSwlDq4Y",
    "code": "X076AR3HE2",
    "amount": 2990,
    "paid_amount": 2990,
    "status": "paid",
    "currency": "BRL",
    "payment_method": "credit_card",
    "paid_at": "2024-07-10T18:18:40",
    "created_at": "2024-07-10T18:18:40",
    "updated_at": "2024-07-10T18:18:40",
    "order": {
      "id": "or_7R9orvycrZhYGoa8",
      "code": "X076AR3HE2",
      "amount": 2990,
      "closed": True,
      "created_at": "2024-07-10T18:18:40",
      "updated_at": "2024-07-10T18:18:40",
      "closed_at": "2024-07-10T18:18:40",
      "currency": "BRL",
      "status": "paid",
      "customer_id": "cus_yKaRk61HrdFV3q4b",
      "metadata": {
        "_id": "668eb4c9addeb545a1f5846c"
      }
    },
    "customer": {
      "id": "cus_yKaRk61HrdFV3q4b",
      "name": "Tony Stark",
      "email": "teowhhmw@quyfwkqn.com.br",
      "document": "99524989248",
      "document_type": "cpf",
      "type": "individual",
      "delinquent": False,
      "created_at": "2024-07-10T18:18:40",
      "updated_at": "2024-07-10T18:18:40",
      "phones": {}
    },
    "last_transaction": {
      "operation_key": "686614565",
      "id": "tran_Rn4NEydUOc5nlbzv",
      "transaction_type": "credit_card",
      "gateway_id": "4feff033-8d8b-4c22-834e-69ae2603ab49",
      "amount": 2990,
      "status": "captured",
      "success": True,
      "installments": 1,
      "statement_descriptor": "AVENGERS",
      "acquirer_name": "simulator",
      "acquirer_tid": "161139906",
      "acquirer_nsu": "61423",
      "acquirer_auth_code": "159",
      "acquirer_message": "Transação capturada com sucesso",
      "acquirer_return_code": "00",
      "operation_type": "auth_and_capture",
      "card": {
        "id": "card_yBYLoPJgs2hyWqPj",
        "first_six_digits": "400000",
        "last_four_digits": "0010",
        "brand": "Visa",
        "holder_name": "Tony Stark",
        "exp_month": 1,
        "exp_year": 2030,
        "status": "active",
        "type": "credit",
        "created_at": "2024-07-10T18:18:40",
        "updated_at": "2024-07-10T18:18:40",
        "billing_address": {
          "zip_code": "90265",
          "city": "Malibu",
          "state": "CA",
          "country": "US",
          "line_1": "10880, Malibu Point, Malibu Central"
        }
      },
      "payment_type": "PAN",
      "created_at": "2024-07-10T18:18:40",
      "updated_at": "2024-07-10T18:18:40",
      "gateway_response": {
        "code": "200",
        "errors": []
      },
      "antifraud_response": {},
      "metadata": {}
    },
    "metadata": {
      "_id": "668eb4c9addeb545a1f5846c"
    }
  }
}

    if (TYPE == "pix"):
        body = {
  "id": "hook_2qYk8ZXUdZH59ZBa",
  "account": {
    "id": "acc_qANKDm9UBziNRxyb",
    "name": "Loja on-line  - test"
  },
  "type": "charge.paid",
  "created_at": "2024-07-10T18:18:40.863Z",
  "data": {
    "id": "ch_ye51D9qcGSwlDq4Y",
    "code": "X076AR3HE2",
    "amount": 2990,
    "paid_amount": 2990,
    "status": "paid",
    "currency": "BRL",
    "payment_method": "credit_card",
    "paid_at": "2024-07-10T18:18:40",
    "created_at": "2024-07-10T18:18:40",
    "updated_at": "2024-07-10T18:18:40",
    "order": {
      "id": "or_7R9orvycrZhYGoa8",
      "code": "X076AR3HE2",
      "amount": 2990,
      "closed": True,
      "created_at": "2024-07-10T18:18:40",
      "updated_at": "2024-07-10T18:18:40",
      "closed_at": "2024-07-10T18:18:40",
      "currency": "BRL",
      "status": "paid",
      "customer_id": "cus_yKaRk61HrdFV3q4b",
      "metadata": {
        "_id": "668eb4c9addeb545a1f5846c"
      }
    },
    "customer": {
      "id": "cus_yKaRk61HrdFV3q4b",
      "name": "Tony Stark",
      "email": "teowhhmw@quyfwkqn.com.br",
      "document": "99524989248",
      "document_type": "cpf",
      "type": "individual",
      "delinquent": False,
      "created_at": "2024-07-10T18:18:40",
      "updated_at": "2024-07-10T18:18:40",
      "phones": {}
    },
    "last_transaction": {
      "operation_key": "686614565",
      "id": "tran_Rn4NEydUOc5nlbzv",
      "transaction_type": "credit_card",
      "gateway_id": "4feff033-8d8b-4c22-834e-69ae2603ab49",
      "amount": 2990,
      "status": "captured",
      "success": True,
      "installments": 1,
      "statement_descriptor": "AVENGERS",
      "acquirer_name": "simulator",
      "acquirer_tid": "161139906",
      "acquirer_nsu": "61423",
      "acquirer_auth_code": "159",
      "acquirer_message": "Transação capturada com sucesso",
      "acquirer_return_code": "00",
      "operation_type": "auth_and_capture",
      "card": {
        "id": "card_yBYLoPJgs2hyWqPj",
        "first_six_digits": "400000",
        "last_four_digits": "0010",
        "brand": "Visa",
        "holder_name": "Tony Stark",
        "exp_month": 1,
        "exp_year": 2030,
        "status": "active",
        "type": "credit",
        "created_at": "2024-07-10T18:18:40",
        "updated_at": "2024-07-10T18:18:40",
        "billing_address": {
          "zip_code": "90265",
          "city": "Malibu",
          "state": "CA",
          "country": "US",
          "line_1": "10880, Malibu Point, Malibu Central"
        }
      },
      "payment_type": "PAN",
      "created_at": "2024-07-10T18:18:40",
      "updated_at": "2024-07-10T18:18:40",
      "gateway_response": {
        "code": "200",
        "errors": []
      },
      "antifraud_response": {},
      "metadata": {}
    },
    "metadata": {
      "_id": "668eb4c9addeb545a1f5846c"
    }
  }
}

    if (TYPE == "boleto"):
        body = {
  "id": id,
  "account": {
    "id": "acc_qANKDm9UBziNRxyb",
    "name": "Loja on-line  - test"
  },
  "type": "charge.created",
  "created_at": "2024-07-10T18:44:13.483Z",
  "data": {
    "id": "ch_7gPpBONSPJhZbGvn",
    "code": code,
    "amount": 3090,
    "status": "pending",
    "currency": "BRL",
    "payment_method": "boleto",
    "created_at": "2024-07-10T18:44:13",
    "updated_at": "2024-07-10T18:44:14",
    "order": {
      "id": "or_dleMoD6ipJTWJKG7",
      "code": "N3WPUVGFM5",
      "amount": 3090,
      "closed": True,
      "created_at": "2024-07-10T18:44:13",
      "updated_at": "2024-07-10T18:44:14",
      "closed_at": "2024-07-10T18:44:13",
      "currency": "BRL",
      "status": "pending",
      "customer_id": "cus_Wr35DXuPmHKb5xNq",
      "metadata": {
        "_id": "668ef50cce62095db191c767"
      }
    },
    "customer": {
      "id": "cus_Wr35DXuPmHKb5xNq",
      "name": "Tony Stark",
      "document_type": "cpf",
      "type": "individual",
      "delinquent": False,
      "address": {
        "id": "addr_ADXJrlcY4c2gZ1Mm",
        "line_1": "375, Av. General Justo, Centro",
        "line_2": "8º andar",
        "zip_code": "20021130",
        "city": "Rio de Janeiro",
        "state": "RJ",
        "country": "BR",
        "status": "active",
        "created_at": "2024-07-10T18:44:13",
        "updated_at": "2024-07-10T18:44:13"
      },
      "created_at": "2024-07-10T18:44:13",
      "updated_at": "2024-07-10T18:44:13",
      "phones": {}
    },
    "last_transaction": {
      "id": "tran_0VQLV2KT2mCV2Lvz",
      "transaction_type": "boleto",
      "gateway_id": "eef413d5-8872-4cc3-9f74-78713ecf6e38",
      "amount": 3090,
      "status": "generated",
      "success": True,
      "url": "https://simulatorpages.pagar.me/boleto/eef413d5-8872-4cc3-9f74-78713ecf6e38",
      "pdf": "https://api.pagar.me/core/v5/transactions/tran_0VQLV2KT2mCV2Lvz/pdf",
      "line": "23792656029000471149635005393703774970000003663",
      "barcode": "https://api.pagar.me/core/v5/transactions/tran_0VQLV2KT2mCV2Lvz/barcode",
      "qr_code": "https://api.pagar.me/core/v5/transactions/tran_0VQLV2KT2mCV2Lvz/qrcode",
      "nosso_numero": "1111111",
      "type": "DM",
      "bank": "001",
      "document_number": "123",
      "instructions": "Pagar até o vencimento",
      "due_at": "2024-09-20T23:59:59",
      "created_at": "2024-07-10T18:44:13",
      "updated_at": "2024-07-10T18:44:13",
      "gateway_response": {
        "code": "200"
      },
      "antifraud_response": {},
      "metadata": {}
    },
    "metadata": {
      "_id": id_client_db
    }
  }
}
        payload02 = {
  "id": id_modificador,
  "account": {
    "id": "acc_qANKDm9UBziNRxyb",
    "name": "Loja on-line  - test"
  },
  "type": "charge.paid",
  "created_at": "2024-07-10T18:44:21.58Z",
  "data": {
    "id": "ch_7gPpBONSPJhZbGvn",
    "code": code,
    "amount": 3090,
    "paid_amount": 3090,
    "status": "paid",
    "currency": "BRL",
    "payment_method": "boleto",
    "paid_at": "2024-07-10T18:44:14",
    "created_at": "2024-07-10T18:44:13",
    "updated_at": "2024-07-10T18:44:21",
    "order": {
      "id": "or_dleMoD6ipJTWJKG7",
      "code": "N3WPUVGFM5",
      "amount": 3090,
      "closed": True,
      "created_at": "2024-07-10T18:44:13",
      "updated_at": "2024-07-10T18:44:21",
      "closed_at": "2024-07-10T18:44:13",
      "currency": "BRL",
      "status": "paid",
      "customer_id": "cus_Wr35DXuPmHKb5xNq",
      "metadata": {
        "_id": "668eb4c9addeb545a1f5846c"
      }
    },
    "customer": {
      "id": "cus_Wr35DXuPmHKb5xNq",
      "name": "Tony Stark",
      "document_type": "cpf",
      "type": "individual",
      "delinquent": False,
      "address": {
        "id": "addr_ADXJrlcY4c2gZ1Mm",
        "line_1": "375, Av. General Justo, Centro",
        "line_2": "8º andar",
        "zip_code": "20021130",
        "city": "Rio de Janeiro",
        "state": "RJ",
        "country": "BR",
        "status": "active",
        "created_at": "2024-07-10T18:44:13",
        "updated_at": "2024-07-10T18:44:13"
      },
      "created_at": "2024-07-10T18:44:13",
      "updated_at": "2024-07-10T18:44:13",
      "phones": {}
    },
    "last_transaction": {
      "id": "tran_QVBKmlYtZI7GEZLJ",
      "transaction_type": "boleto",
      "gateway_id": "eef413d5-8872-4cc3-9f74-78713ecf6e38",
      "amount": 3090,
      "status": "paid",
      "success": True,
      "paid_amount": 3090,
      "paid_at": "2024-07-10T18:44:14",
      "url": "https://simulatorpages.pagar.me/boleto/eef413d5-8872-4cc3-9f74-78713ecf6e38",
      "pdf": "https://api.pagar.me/core/v5/transactions/tran_0VQLV2KT2mCV2Lvz/pdf",
      "line": "23792656029000471149635005393703774970000003663",
      "barcode": "https://api.pagar.me/core/v5/transactions/tran_0VQLV2KT2mCV2Lvz/barcode",
      "qr_code": "https://api.pagar.me/core/v5/transactions/tran_0VQLV2KT2mCV2Lvz/qrcode",
      "nosso_numero": "1111111",
      "type": "DM",
      "bank": "001",
      "document_number": "123",
      "instructions": "Pagar até o vencimento",
      "due_at": "2024-09-20T23:59:59",
      "created_at": "2024-07-10T18:44:21",
      "updated_at": "2024-07-10T18:44:21",
      "gateway_response": {},
      "antifraud_response": {},
      "metadata": {}
    },
    "metadata": {
      "_id": id_client_db
    }
  }
}
    #
    #
    #
    final_payload = {**payload, **body}

    response   = requests.request("POST", url, headers=headers, data=json.dumps(final_payload))



    response02 = requests.request("POST", url2, headers=headers,data=json.dumps(payload02))
    end_time = time.time()
    duration = end_time - start_time
    print(f">>> CONSOLE: [ {index} ] - {response.status_code} | {TYPE} | {duration:.4f} segundos")

formas_pagamento = ["pix", "credit_card", "boleto"]

# Lista para manter as threads
threads = []

# Criar e iniciar threads
for i in range(1500):
    forma_pagamento = random.choice(formas_pagamento)
    thread = threading.Thread(target=enviarRequest, args=(i, forma_pagamento))
    threads.append(thread)
    thread.start()
    time.sleep(5)

# Aguardar que todas as threads terminem
contador = 0
for thread in threads:
    thread.join()

input("Todas as requisições foram executadas.")
