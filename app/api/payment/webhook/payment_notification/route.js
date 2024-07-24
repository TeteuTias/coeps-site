import { NextApiRequest, NextApiResponse } from 'next';
import { Collection, ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb';
//
//
/**
 * RECEBE:
 *  charge.created -> Essa notificação é disparada quando uma cobrança é criada.
 * FUNÇÃO:
 *  Ele pega algumas informações do pagamento criado e joga lá no mongodb.
 */
//
export async function POST(request, response) {
  //console.log("============== payment_notification_urls ================")
  const PAGBANK_API_KEY = process.env.PAGBANK_API_KEY
  try {
    const requestData = await request.json()
    switch (true) {
      case requestData.event == "PAYMENT_CONFIRMED":
        var msg = await pagamentoRecebido(requestData)
        return Response.json(msg)
      case requestData.event == "PAYMENT_OVERDUE":
        var msg = await pagamentoVencido(requestData)
        return Response.json(msg)
      case requestData.event.includes("REFUND"):
        var msg = await pagamentoEstorno(requestData)
        return Response.json(msg)
    }


    return Response.json({ "message": '!witch' }, { status: 400 })
  }
  catch (error) {
    return Response.json({ "error": error }, { status: 500 })
  }

}
// Confirma o pgamento escrevendo ele no DB.
async function pagamentoRecebido(requestData) { // Chame se, somente se, o pagamento estiver CONFIRMADO.


  // Setando variáveis importantes
  const id_api = requestData.payment.customer
  const invoiceNumber = requestData.payment.invoiceNumber
  const { db } = await connectToDatabase()
  const collection = 'usuarios'

  const paymentType = await getPaymentByInvoiceNumber(invoiceNumber, db, collection, id_api)
  // console.log(paymentType)
  if (!paymentType) {
    return { "message": '!paymentType' }, { status: 500 }
  }//ticket | activity
  if (paymentType == "ticket") {
    const filter = {
      id_api,
      "pagamento.lista_pagamentos.invoiceNumber": invoiceNumber
    };
    const update = {
      $push: {
        "pagamento.lista_pagamentos.$[elem]._webhook": requestData
      },
      $set: {
        "pagamento.lista_pagamentos.$[elem].status": requestData.event,
        "pagamento.situacao": 1
      },

    };
    const options = {
      arrayFilters: [{ "elem.invoiceNumber": invoiceNumber }]
    };
    var result = await db.collection(collection).updateOne(filter, update, options);
    if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
      //console.log("result.matchedCount === 0")
      return Response.json({ "erro": "result.matchedCount - pagamentoRecebido()" }, { status: 404 })
    }
    else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
      //console.log("result.modifiedCount === 0")
      return Response.json({ "erro": "result.modifiedCount === 0 - pagamentoRecebido()" }, { status: 400 })
    }
    return { "message": 'success' }, { status: 200 }

  }
  if (paymentType == "activity") {
    const filter = {
      id_api,
      "pagamento.lista_pagamentos.invoiceNumber": invoiceNumber
    };
    const update = {
      $push: {
        "pagamento.lista_pagamentos.$[elem]._webhook": requestData
      },
      $set: {
        "pagamento.lista_pagamentos.$[elem].status": requestData.event,
      },

    };
    const options = {
      arrayFilters: [{ "elem.invoiceNumber": invoiceNumber }]
    };
    var result = await db.collection(collection).updateOne(filter, update, options);
    if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
      //console.log("result.matchedCount === 0")
      return Response.json({ "erro": "result.matchedCount - pagamentoRecebido()" }, { status: 404 })
    }
    else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
      //console.log("result.modifiedCount === 0")
      return Response.json({ "erro": "result.modifiedCount === 0 - pagamentoRecebido()" }, { status: 400 })
    }
    return { "message": 'success' }, { status: 200 }

  }
  // Dando baixa no DB.
  return { "message": '!paymentType configured' }, { status: 500 }

}

// Ele dá baixa falando que está vencido e assim, permitindo o usuário fazer outro pagamento.
async function pagamentoVencido(requestData) { // Chame se, somente se, o pagamento estiver OVERDUE.
  // Setando variáveis importantes

  const id_api = requestData.payment.customer
  const invoiceNumber = requestData.payment.invoiceNumber

  const { db } = await connectToDatabase()
  const collection = 'usuarios'

  const paymentType = await getPaymentByInvoiceNumber(invoiceNumber, db, collection, id_api)
  if (!paymentType) {
    return { "message": '!paymentType' }, { status: 500 }
  }//ticket | activity

  if (paymentType == "ticket") {
    //
    // Dando baixa no DB.
    const filter = {
      id_api,
      "pagamento.lista_pagamentos.invoiceNumber": invoiceNumber
    };
    const update = {
      $push: {
        "pagamento.lista_pagamentos.$[elem]._webhook": requestData
      },
      $set: {
        "pagamento.lista_pagamentos.$[elem].status": requestData.event,
        "pagamento.situacao": 0
      },

    };
    const options = {
      arrayFilters: [{ "elem.invoiceNumber": invoiceNumber }]
    };
    const result = await db.collection(collection).updateOne(filter, update, options);
    if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
      //console.log("result.matchedCount === 0")
      return Response.json({ "erro": "result.matchedCount - pagamentoRecebido()" }, { status: 404 })
    }
    else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
      //console.log("result.modifiedCount === 0")
      return Response.json({ "erro": "result.modifiedCount === 0 - pagamentoRecebido()" }, { status: 400 })
    }

    return { "message": 'success' }, { status: 200 }
  }

  if (paymentType == "activity") {
    //
    // Dando baixa no DB.
    const filter = {
      id_api,
      "pagamento.lista_pagamentos.invoiceNumber": invoiceNumber
    };
    const update = {
      $push: {
        "pagamento.lista_pagamentos.$[elem]._webhook": requestData
      },
      $set: {
        "pagamento.lista_pagamentos.$[elem].status": requestData.event,
      },

    };
    const options = {
      arrayFilters: [{ "elem.invoiceNumber": invoiceNumber }]
    };
    const result = await db.collection(collection).updateOne(filter, update, options);
    if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
      //console.log("result.matchedCount === 0")
      return Response.json({ "erro": "result.matchedCount - pagamentoRecebido()" }, { status: 404 })
    }
    else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.

      return Response.json({ "erro": "result.modifiedCount === 0 - pagamentoRecebido()" }, { status: 400 })
    }
    //
    //
    const userId = await getUserIdByInvoiceNumber(invoiceNumber, db, collection, id_api)
    if (!userId) {
      return { "message": '!userId' }, { status: 500 }
    }
    const _eventID = await getEventIdByInvoiceNumber(invoiceNumber, db, collection, id_api)
    if (!_eventID) {
      return { "message": '!_eventID' }, { status: 500 }
    }
    //
    //


    const result2 = await db.collection('minicursos').updateOne(
      { _id: new ObjectId(_eventID) }, // Query para encontrar o documento
      {
        $pull: {
          'participants': userId // Remove o elemento específico
        }
      }
    )

    return { "message": 'success' }, { status: 200 }
  }

}
// Apenas escreve na tela os states correspondentes ao estorno. Ele não é capaz de julgar se a pessoa inda vai ou nao ter acesso ao site.
async function pagamentoEstorno(requestData) { // Chame se, somente se, o pagamento estiver OVERDUE.
  // Setando variáveis importantes
  const id_api = requestData.payment.customer
  const invoiceNumber = requestData.payment.invoiceNumber

  const { db } = await connectToDatabase()
  const collection = 'usuarios'

  // Dando baixa no DB.
  const filter = {
    id_api,
    "pagamento.lista_pagamentos.invoiceNumber": invoiceNumber
  };
  const update = {
    $push: {
      "pagamento.lista_pagamentos.$[elem]._webhook": requestData
    },
    $set: {
      "pagamento.lista_pagamentos.$[elem].status": requestData.event,
    },

  };
  const options = {
    arrayFilters: [{ "elem.invoiceNumber": invoiceNumber }]
  };
  const result = await db.collection(collection).updateOne(filter, update, options);
  if (result.matchedCount === 0) { //Nenhum documento correspondeu ao filtro.
    //console.log("result.matchedCount === 0")
    return Response.json({ "erro": "result.matchedCount - pagamentoRecebido()" }, { status: 404 })
  }
  else if (result.modifiedCount === 0) { // Nenhum documento foi modificado.
    //console.log("result.modifiedCount === 0")
    return Response.json({ "erro": "result.modifiedCount === 0 - pagamentoRecebido()" }, { status: 400 })
  }

  return { "message": 'success' }, { status: 200 }
}

async function getPaymentByInvoiceNumber(invoiceNumber, db, collection, id_api) {
  const user = await db.collection(collection).findOne(
    { id_api },
    {
      projection: {
        "pagamento.lista_pagamentos": 1
      }
    }
  );

  if (user) {
    // Filtre o array no código
    const filteredList = user.pagamento.lista_pagamentos.filter(payment => payment.invoiceNumber === invoiceNumber);
    return filteredList[0]._type;
  }
  return 0

}

async function getEventIdByInvoiceNumber(invoiceNumber, db, collection, id_api) {
  const user = await db.collection(collection).findOne(
    { id_api },
    {
      projection: {
        "pagamento.lista_pagamentos": 1
      }
    }
  );

  if (user) {
    // Filtre o array no código
    const filteredList = user.pagamento.lista_pagamentos.filter(payment => payment.invoiceNumber === invoiceNumber);
    return filteredList[0]._eventID;
  }
  return 0

}

async function getUserIdByInvoiceNumber(invoiceNumber, db, collection, id_api) {
  const user = await db.collection(collection).findOne(
    { id_api },
    {
      projection: {
        "pagamento.lista_pagamentos": 1
      }
    }
  );

  if (user) {
    // Filtre o array no código
    const filteredList = user.pagamento.lista_pagamentos.filter(payment => payment.invoiceNumber === invoiceNumber);
    return filteredList[0]._userId;
  }
  return 0

}