import { connectToDatabase } from '../../../lib/mongodb'
import { ObjectId } from 'bson';
import { getSession, withApiAuthRequired } from '@/lib/auth0-compat';
import { IUser } from '@/lib/types/user/user.t';
//
//
// Aqui ele sempre pega os mesmos parametros para realizar o update.
// assim, SEMPRE ENNVIE NESSE FORMATO: {cpf, numero_telefone, nome}
/** @type {any} */
export const POST = withApiAuthRequired(async function POST(request) {
    try {
        // Puxando informações
        const { user } = await getSession();
        
        const userId = user.sub.replace("auth0|", ""); // Retirando o auth0|  

        if (!userId) {
            return Response.json({ "erro": "!userId" })
        }

        const ASAAS_API_KEY = process.env.ASAAS_API_KEY //process.env.ASAAS_API_KEY
        const ASAAS_API_URL = process.env.ASAAS_API_URL + "/customers"

        const data = await request.json()

        const { db } = await connectToDatabase();

        const userDb: IUser | null = await db.collection('usuarios').findOne({ "_id": new ObjectId(userId) })
        if (!userDb) {
            const b = new ObjectId(userId)
            //
            // Para não ficar criando um Customer novo sempre, vou verificar se já existe. Caso exista, 
            // vamos apenas atualiza-lo. Caso contrário, será criado normalmente.
            const options = {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    access_token: ASAAS_API_KEY
                },
                body: JSON.stringify({
                    'name': data.nome,
                    'email': user.email,
                    'cpfCnpj': data.cpf,
                    'mobilePhone': data.numero_telefone,
                    'observations': userId,
                    'notificationDisabled': true,
                    "externalReference": userId,
                    // NOVO
                    phone: data.phone,
                    address: data.address,
                    addressNumber: data.addressNumber,
                    complement: data.complement,
                    province: data.province,
                    postalCode: data.postalCode,
                    city: data.cidade_nome
                })
            }
            //
            var id_api = ""
            const response = await fetch(ASAAS_API_URL, options)
            // console.log(responseJson)
            if (!response.ok) {
                const errorText = await response.json()
                throw ({ "message": errorText.errors[0].description })
            }
            var responseJson = await response.json()
            id_api = responseJson.id
            //
            //
            //
            const userInsert: IUser = {
                //@ts-expect-error: Apenas um problema de tipificação.
                _id: b,
                id_api: id_api,
                isPos_registration: true,
                informacoes_usuario: {
                    cpf: data.cpf,
                    numero_telefone: data.numero_telefone,
                    nome: data.nome,
                    email: user.email,
                    data_criacao: new Date(),
                    titulo_honorario: '',
                    país: data.pais,
                    cidade: data.cidade,
                    data_nascimento: data.data_nascimento,
                    onde_conheceu: data.onde_conheceu,
                    curso: data.curso,
                    ano_conclusao: Number(data.ano_conclusao),
                    semestre_conclusao: Number(data.semestre_conclusao)
                },
                pagamento: {
                    //@ts-expect-error: Apenas um problema de tipificação.
                    _id: b,
                    situacao: 0,
                    lista_pagamentos: [],
                    situacao_animacao: false,
                    tipo_pagamento: ''
                }
            }
            await db.collection('usuarios').insertOne(userInsert)
            return Response.json({ "sucesso": "Ocorreu Tudo Certo!" })
        }
        // Se o userDb existir, vamos apenas atualizar os dados
        //
        // Para não ficar criando um Customer novo sempre, vou verificar se já existe. Caso exista, 
        // vamos apenas atualiza-lo. Caso contrário, será criado normalmente.
        const options = {
            method: 'PUT',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                access_token: ASAAS_API_KEY
            },
            body: JSON.stringify({
                'name': data.nome,
                'email': user.email,
                'cpfCnpj': data.cpf,
                'mobilePhone': data.numero_telefone,
                'observations': userId,
                'notificationDisabled': true,
                "externalReference": userId,
                // NOVO
                phone: data.phone,
                address: data.address,
                addressNumber: data.addressNumber,
                complement: data.complement,
                province: data.province,
                postalCode: data.postalCode,
                city: data.cidade_nome

            })
        }
        //
        const response = await fetch(`${ASAAS_API_URL}/${userDb.id_api}`, options)
        if (!response.ok) {
            const errorText = await response.json()
            throw ({ "message": errorText.errors[0].description })
        }
        var responseJson = await response.json()
        const putUser: IUser["informacoes_usuario"] = { // informações que vão ser atualizadas sobre o usuário.
            cpf: data.cpf,
            numero_telefone: data.numero_telefone,
            nome: data.nome,
            email: user.email,
            data_criacao: userDb.informacoes_usuario.data_criacao,
            titulo_honorario: '',
            país: data.pais,
            cidade: data.cidade,
            data_nascimento: data.data_nascimento,
            onde_conheceu: data.onde_conheceu,
            curso: data.curso,
            ano_conclusao: Number(data.ano_conclusao),
            semestre_conclusao: Number(data.semestre_conclusao)
        }
        await db.collection('usuarios').findOneAndUpdate({ "_id": new ObjectId(userId) }, {
            "$set": {
                'isPos_registration': true,
                'informacoes_usuario': putUser
            }
        })
        return Response.json({ "sucesso": "Ocorreu Tudo Certo!" })
    }
    catch {
        return Response.json(
            { error: "internal_server_error", message: "Não foi possível salvar os dados do usuário." },
            { status: 500 }
        )
    }


})
