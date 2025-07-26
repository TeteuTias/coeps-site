// utils/authUtils.js
// Verifica o token antes. Se estiver expirado, manda direto para o logout
// Se retornar nada não há problema. Se retornar algo, vai ser um redirecionamento por erro.
//
import { getAccessToken, getSession } from "@auth0/nextjs-auth0/edge";
import { NextRequest, NextResponse } from "next/server";
import { NextFetchEvent } from "next/server";
import { IUser } from "../lib/types/user/user.t"

//
export async function checkAndRefreshToken(req, res) {
    try {
        const { accessToken } = await getAccessToken(req, res);

        // Simular erro de token expirado para fins de teste
        // throw new Error('ERR_EXPIRED_ACCESS_TOKEN');

        return undefined
    } catch (error) {
        const urlLogOut = new URL(req.url)
        urlLogOut.pathname = "/api/auth/logout"
        if (error.message === 'ERR_EXPIRED_ACCESS_TOKEN') {
            return urlLogOut            //return NextResponse.rewrite(urlLogOut);
        }
        return urlLogOut
        //return NextResponse.rewrite(urlLogOut); // QUALQUER ERRO QUE DER VAI PRO LOGOUT
    }
}
//
//
export async function checkAll(req: NextRequest, res) {
    try {
        const session = await getSession(req, res)
        const { accessToken } = await getAccessToken(req, res);
        const requestUrlPath = new URL(req.url).pathname
        //
        const urlFetch = new URL("/api/get/verificacaoUsuario", req.url)
        const response = await fetch(urlFetch.toString(), {
            method: 'get',
            headers: req.headers,
        })
        if (!response.ok) {
            throw new Error('!response.ok');
        }
        const responseJson: { isPos_registration: IUser["isPos_registration"], pagamento: Pick<IUser["pagamento"], "situacao" | "situacao_animacao"> } = await response.json()
        // A primeira verificação é a isPos_registration depois o pagamento.
        //
        if (responseJson.isPos_registration != true) { // se a situação for == 1 voce seta.
            const urlUpdateData = new URL("/updateData", req.url)
            return urlUpdateData
            //return NextResponse.rewrite(urlUpdateData);
        }
        if (responseJson.pagamento.situacao != 1 && !requestUrlPath.includes("/painel/certificados")) { // se a situação for == 1 voce seta.
            const urlPagamentos = new URL("/pagamentos", req.url)
            return urlPagamentos
            //return NextResponse.rewrite(urlPagamentos);
        }
        if (responseJson.pagamento.situacao_animacao == false && responseJson.pagamento.situacao == 1) {
            const urlPagamentos = new URL("/suaInscricaoFoiConfirmada", req.url)
            return urlPagamentos
        }
        if (req.nextUrl.pathname.startsWith('/suaInscricaoFoiConfirmada') && responseJson.pagamento.situacao_animacao == true) {
            const urlPagamentos = new URL("/painel", req.url)
            return urlPagamentos
        }
        return undefined


    } catch (error) {
        //console.log(error)
        const urlLogOut = new URL(req.url)
        urlLogOut.pathname = "/api/auth/logout"
        // console.log(error)
        return urlLogOut
        //return NextResponse.rewrite(urlLogOut); // QUALQUER ERRO QUE DER VAI PRO LOGOUT
    }
}
//
//
export async function checkRoutes(req, res) {
    // Tratando rotas ESPECIAIS.
    if (req.nextUrl.pathname.startsWith('/updateData')) {
        // Se ele chegou até aqui, é porque ele não precisa mais ir para updateData. Assim, não faz sentido ele ir.
        const urlPainel = new URL('/painel', req.url)
        //return NextResponse.rewrite(new URL('/painel', req.url))
        return urlPainel
    }
    return undefined
}
//
//

