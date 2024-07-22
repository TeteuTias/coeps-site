import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/app/lib/mongodb'
import { getAccessToken, getSession } from '@auth0/nextjs-auth0';
import { withApiAuthRequired } from '@auth0/nextjs-auth0';
import isValidCPF from '@/app/utils/authCpf';
//
//
//
export const PUT = withApiAuthRequired(async function (request) {



    try {
        //

        const { user } = await getSession();
        const _id = new ObjectId(user.sub.replace("auth0|", "")) // Retirando o auth0|  
        //
        const value = await request.json()
        //
        switch (true) {
            case value.nome != undefined:
                var check = verificationInputs("name", value.nome);
                if (check !== 0) { throw new Error(check.message || check.error); }
                return updateOnDb({ "informacoes_usuario.nome": value.nome.trim() }, _id)
            case value.cpf != undefined:
                var check = verificationInputs("cpf", value.cpf);
                if (check !== 0) { throw new Error(check.message || check.error); }
                return updateOnDb({ "informacoes_usuario.cpf": value.cpf.trim() }, _id)
            case value.numero_telefone != undefined:
                var check = verificationInputs("phone", value.numero_telefone);
                if (check !== 0) { throw new Error(check.message || check.error); }
                return updateOnDb({ "informacoes_usuario.numero_telefone": value.numero_telefone.trim() }, _id)
            case value.email != undefined:
                return updateOnDb({ "informacoes_usuario.email": value.email.trim() }, _id)
        }

        throw new Error('!Case')
    }
    catch (error) {
        return Response.json({ 'message': error.message || "Ocorreu um erro desconhecido" }, { status: 500 })
    }
})
const verificationInputs = (type, input) => {
    switch (type) {
        case "name":
            switch (true) {
                case input.trim() === "":
                    return { "message": "Preencha o campo antes de realizar a alteração." };
                case input.trim().length > 100:
                    return { "message": "Você ultrapassou o limite de caracteres" };
                case /\d/.test(input.trim()):
                    return { "error": "Utilize apenas letras" };
                default:
                    return 0;
            }

        case "cpf":
            // Remove caracteres não numéricos
            const cleanedInput = input.replace(/[^\d]/g, '');

            switch (true) {
                case cleanedInput.length !== 11:
                    return { "message": "O CPF deve ter 11 dígitos" };
                case !/^\d{11}$/.test(cleanedInput):
                    return { "message": "O CPF deve conter apenas dígitos" };
                case !isValidCPF(cleanedInput):
                    return { "message": "O CPF é inválido." };
                default:
                    return 0;
            }

        case "phone":
            // Remove caracteres não numéricos
            const cleanedPhone = input.replace(/[^\d]/g, '');
            switch (true) {
                case cleanedPhone.length !== 11: // Para telefones brasileiros, com DDD e número
                    return { "message": "O número de telefone deve ter 11 dígitos, incluindo o DDD" };
                case !/^\d{11}$/.test(cleanedPhone):
                    return { "message": "O número de telefone deve conter apenas dígitos" };
                default:
                    return 0;
            }

        default:
            return 0;
    }


}

const updateOnDb = async (update, _id) => {
    // update -> {campo_a_ser_atualizado: atualizacao}
    //
    const { db } = await connectToDatabase();
    const result = await db.collection('usuarios').updateOne(
        { _id },
        { $set: update }
    );
    return Response.json({ "message": "Atualização feita com sucesso!" }, { status: 200 })

    //
    //
}