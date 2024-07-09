import { NextResponse } from 'next/server';
import { getAccessToken } from '@auth0/nextjs-auth0';
import { execOnce } from 'next/dist/shared/lib/utils';

export async function GET() {
    try{
        const { accessToken } = await getAccessToken();
        
        const response = await fetch('https://dev-kj0gfrsdev5h0hkl.us.auth0.com/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        //console.log(response)
        const userData = await response.json();
        const userId = userData.sub;

        console.log('Dados do usuário:', userId);
        //
        return NextResponse.json({ foo: 'bar' });

    }
    catch {
        return NextResponse.json({"Não":"Logado"})
    }
}