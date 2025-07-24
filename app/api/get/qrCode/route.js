import { ObjectId } from 'mongodb';
import QRCode from 'qrcode';
import { withApiAuthRequired, getSession } from '@auth0/nextjs-auth0';
import { connectToDatabase } from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

export const GET = withApiAuthRequired(async (req) => {
  try {
    const session = await getSession(req);
    if (!session?.user?.sub) {
      return NextResponse.json({ error: 'Usuário não autenticado.' }, { status: 401 });
    }

    // Extrai o id removendo o prefixo "auth0|"
    const fullSub = session.user.sub; // ex: "auth0|66bbfaff9353f2fc20c157d1"
    const idStr = fullSub.replace('auth0|', '');

    if (!ObjectId.isValid(idStr)) {
      return NextResponse.json({ error: 'ID do usuário inválido.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const userDoc = await db.collection('usuarios').findOne(
      { _id: new ObjectId(idStr) },
      {
        projection: {
          _id: 1,
          'informacoes_usuario.nome': 1,
          'informacoes_usuario.email': 1,
        },
      }
    );

    if (!userDoc) {
      console.log('Usuário não encontrado para _id:', idStr);
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
    }

    const nome = userDoc.informacoes_usuario?.nome || 'Nome não encontrado';
    const email = userDoc.informacoes_usuario?.email || 'Email não encontrado';

    // Cor carmesim do site (exemplo: #A8323E), fundo branco
    const qrCodeBase64 = await QRCode.toDataURL(idStr, {
      color: {
        dark: '#541A2C', // carmesim do site
        light: '#FFFFFF', // fundo branco
      },
      margin: 2, // margem para quiet zone
      width: 400 // resolução maior para qualidade
    });

    return NextResponse.json(
      {
        id: idStr,
        nome,
        email,
        qrCode: qrCodeBase64,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Erro ao gerar QR:', error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
});
