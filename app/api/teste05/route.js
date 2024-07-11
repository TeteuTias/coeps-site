import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
//
export async function POST(request) {
  try {
    const body = await request.json();
    const type = 'pix'//body.type
    const documento = body.documento
    const email = body.email
    const telefone = body.telefone

    const pagarmeApiKey = 'sk_test_6bdf3eefaa574f43846df1e02f38145d';
    
    switch (true) {
      case type == 'pix':
        var response = await fetch('https://api.pagar.me/core/v5/orders', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${pagarmeApiKey}:`).toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify( 
            {
            "items": [
              {
                  "amount": 2990,
                  "description": "Chaveiro do Tesseract",
                  "quantity": 1
              }
        ],
        "payments": [
            {
                "amount":3000,
                "payment_method": "checkout",
                "checkout": {
                  "expires_in":120,
                  "billing_address_editable" : true,
                  "customer_editable" : true,
                  "accepted_payment_methods": ["credit_card"],
                  "success_url": "https://www.pagar.me",
                  "credit_card": {}
                }
            }
        ],
              "metadata":{
                "_id":new ObjectId("668eb4c9addeb545a1f5846c")
              }
          }
          ),
        });
        //console.log(response)
        var resposta = await response.json()
        return NextResponse.json({"resposta":resposta})
      case type == 'credit_card':
        var response = await fetch('https://api.pagar.me/core/v5/orders', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${pagarmeApiKey}:`).toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify( 
            {"items": [
        {
            "amount": 2990,
            "description": "Chaveiro do Tesseract",
            "quantity": 1
        }
    ],
    "customer": {
        "name": "Tony Stark",
        "email": email,
        "document_type": "CPF",
        "document": documento,
        "type": "Individual",
    },
    "payments": [
        {
            "payment_method": "credit_card",
            "credit_card": {
                "recurrence": false,
                "installments": 1,
                "statement_descriptor": "AVENGERS",
                "card": {
                    "number": "4000000000000010",
                    "holder_name": "Tony Stark",
                    "exp_month": 1,
                    "exp_year": 30,
                    "cvv": "3531",
                    "billing_address": {
                        "line_1": "10880, Malibu Point, Malibu Central",
                        "zip_code": "90265",
                        "city": "Malibu",
                        "state": "CA",
                        "country": "US"                
                    }
                }
            }
        }
    ],
              "metadata":{
                "_id":new ObjectId("668eb4c9addeb545a1f5846c")
              }
          }
          ),
        });
        return NextResponse.json({})
      case type == 'boleto':
        var response = await fetch('https://api.pagar.me/core/v5/orders', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${pagarmeApiKey}:`).toString('base64'),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify( 
            {"items": [
        {
            "amount": 2990,
            "description": "Chaveiro do Tesseract",
            "quantity": 1
        }
    ],
    "customer": {
        "name": "Tony Stark",
        "email": email ,
        "document_type": "CPF",
        "document": documento,
        "type": "Individual",
        "address": {
    	"line_1": "375, Av. General Justo, Centro",
    	"line_2": "8º andar",
    	"zip_code": "20021130",
    	"city": "Rio de Janeiro",
    	"state": "RJ",
    	"country": "BR"
    }
    },
    "shipping": {
        "amount": 100,
        "description": "Stark",
        "recipient_name": "Tony Stark",
        "recipient_phone": "24586787867",
        "address": {
            "line_1": "10880, Malibu Point, Malibu Central",
            "zip_code": "90265",
            "city": "Malibu",
            "state": "CA",
            "country": "US"    
        }
    },
    "payments": [
        {
            "payment_method": "boleto",
      "boleto": {
        "instructions": "Pagar até o vencimento",
        "due_at": "2024-09-20T00:00:00Z",
        "document_number": "123",
        "type": "DM"            
                    }
                }
           
        
    ],
              "metadata":{
                "_id":new ObjectId("668eb4c9addeb545a1f5846c")
              }
          }
          ),
        });
        return NextResponse.json({})
      default:
        return NextResponse.json({})

    }


    if (!response.ok) {
      //console.log("!ok")
      const errorDetails = await response.json();
      //console.log(errorDetails)
      return NextResponse.json({ error: 'Erro ao fazer a requisição à API do Pagar.me', details: errorDetails }, { status: response.status });
    }

    const data = await response.json();
    //console.log("ok")

    return NextResponse.json(data);
  } catch (error) {
    //console.log("catch")

    return NextResponse.json({ error: 'Erro ao fazer a requisição à API do Pagar.me', details: error.message });
  }
}
