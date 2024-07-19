// utils/authUtils.js
// Verifica o token antes. Se estiver expirado, manda direto para o logout
// Se retornar nada não há problema. Se retornar algo, vai ser um redirecionamento por erro.
//
import { getAccessToken, getSession } from "@auth0/nextjs-auth0/edge";
import { NextResponse } from "next/server";
import { NextFetchEvent } from "next/server";

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
            return NextResponse.rewrite(urlLogOut);
        }
        return NextResponse.rewrite(urlLogOut); // QUALQUER ERRO QUE DER VAI PRO LOGOUT
    }
}0
//
//
export async function checkAll(req, res) {
    try {
        const session = await getSession(req, res)
        const { accessToken } = await getAccessToken(req, res);

        //
        const urlFetch = new URL("/api/get/verificacaoUsuario",req.url)
        const response = await fetch(urlFetch.toString(), {
            method: 'get',
            headers: req.headers,

        })
        if (!response.ok) {
            throw new Error('!response.ok');
        }
        const responseJson = await response.json()
        // A primeira verificação é a isPos_registration depois o pagamento.
        //
        if (responseJson.isPos_registration != 1) { // se a situação for == 1 voce seta.
            const urlPagamentos = new URL("/updateData",req.url)
            return NextResponse.rewrite(urlPagamentos);
        }
        if (responseJson.pagamento.situacao != 1) { // se a situação for == 1 voce seta.
            const urlPagamentos = new URL("/painel/pagamentos",req.url)
            return NextResponse.rewrite(urlPagamentos);
        }
        return undefined


    } catch (error) {
        //console.log(error)
        const urlLogOut = new URL(req.url)
        urlLogOut.pathname = "/api/auth/logout"
        console.log(error)
        return NextResponse.rewrite(urlLogOut); // QUALQUER ERRO QUE DER VAI PRO LOGOUT
    }
}

