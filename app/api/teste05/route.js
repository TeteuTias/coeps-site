import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
//
export async function POST(request) {

    const pagarmeApiKey = '9aa8620e-d2e9-4cbe-aeaf-25e90c39bfff248c131f423ca7dd507c1d812cf8ba380c81-9705-42fe-bf27-e873b75440da';

        var response = await fetch('https://sandbox.api.pagseguro.com/checkouts', {
          method: 'POST',
          headers: {
            "accept": "*/*",
            'Authorization': `Bearer ${pagarmeApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify( 
            
            {
              "reference_id": "REFERÊNCIA DO PRODUTO",
              "expiration_date": "2024-08-14T19:09:10-03:00",
              "customer": {
                  "name": "João teste",
                  "email": "joao@teste.com",
                  "tax_id": "12345678909",
                  "phone": {
                      "country": "+55",
                      "area": "27",
                      "number": "999999999"
                  }
              },
              "customer_modifiable": true,
              "items": [
                  {
                      "reference_id": "ITEM01",
                      "name": "Nome do Produto",
                      "quantity": 1,
                      "unit_amount": 500,
                      "image_url": "https://www.petz.com.br/blog//wp-content/upload/2018/09/tamanho-de-cachorro-pet-1.jpg"
                  }
              ],
              "additional_amount": 0,
              "discount_amount": 0,
              "shipping": {
                  "type": "FREE",
                  "amount": 0,
                  "service_type": "PAC",
                  "address": {
                      "country": "BRA",
                      "region_code": "SP",
                      "city": "São Paulo",
                      "postal_code": "01452002",
                      "street": "Faria Lima",
                      "number": "1384",
                      "locality": "Pinheiros",
                      "complement": "5 andar"
                  },
                  "address_modifiable": true,
                  "box": {
                      "dimensions": {
                          "length": 15,
                          "width": 10,
                          "height": 14
                      },
                      "weight": 300
                  }
              },
              "payment_methods": [{
                      "type": "credit_card",
                      "brands": ["mastercard"]
                  }, {
                      "type": "credit_card",
                      "brands": ["visa"]
                  }, {
                      "type": "debit_card",
                      "brands": ["visa"]
                  }, { "type": "PIX" }, { "type": "BOLETO" }],
              "payment_methods_configs": [
                  {
                      "type": "credit_card",
                      "config_options": [
                          {
                              "option": "installments_limit",
                              "value": "1"
                          }
                      ]
                  }
              ],
              "soft_descriptor": "xxxx",
              "redirect_url": "https://pagseguro.uol.com.br",
              "return_url": "https://pagseguro.uol.com.br",
              "notification_urls": ["https://92fdeadeeee2.ngrok.app/api/teste06"],
              "payment_notification_urls": ["https://92fdeadeeee2.ngrok.app/api/teste07"]
          }

          ),
        });
        //console.log(response)
        var resposta = await response.json()
        return NextResponse.json({"resposta":resposta})

}
