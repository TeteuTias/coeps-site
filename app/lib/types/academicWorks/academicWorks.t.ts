import { ObjectId } from "bson"


export interface IAcademicWorksProps {
    "data_inicio_submissao": string, // essa data está em string, já com o fuso -03:00
    "data_limite_submissao": string, // essa data está em string, já com o fuso -03:00
    "data_publicacao_resultados": string,
    "maximo_postagem_por_usuario": number, // temos um bloqueio geral, que fala quanto o usuário pode postar de trabalho AO TODO, e lá embaixo, temos um bloqueio específico de quanto o usuario pode postar por tema 
    "resultados": {
        link: string,
        titulo: string,
        data_publicacao: string
    }[],
    "link_edital": string,
    "link_guia"?: string,
    "modalidades"?: { // Coloquei como opcional pois pode acontecer de apaguarem todas as modalidades
        _id: ObjectId,
        modalidade: string,
        autores_por_trabalho: number,
        trabalhos_por_usuario: number,
        maximo_orientadores: number,
        postagens_maximas: number,
        chunk_limite: number,
        chunk_tamanho: number,
        limite_maximo_de_postagem: number,
        ficha_avalicao: {
            _id: ObjectId,
            nome: string,
            notaMinima: number,
            notaMaxima: number,
            peso: number,
            notasRecebidas: number[],
            justificativa: string[],
        }[],
    }[]
    "isOpen": boolean,
}
export interface IAcademicWorks {
    _id: ObjectId;
    userId: ObjectId;
    titulo: string;
    modalidade: string;
    autores: {
        nome: string;
        email: string;
        cpf: string;
        isOrientador: boolean;
        isPagante: boolean;
    }[];
    arquivos: {
        fileId: ObjectId,
        fileName: string,
        originalName: string,
        size: number,
        uploadDate: Date,
        url: string
    }[];
    topicos: {
        resu: string,
        intro: string,
        obj: string,
        met: string,
        disc: string,
        conc: string,
        pchave: string,
        ref: string,
    };
    status: "Em Avaliação" | "Aceito" | "Recusado" | "Necessita de Alteração";
    dataSubmissao: Date;
    avaliadorComentarios: {
        comentario: string;
        avaliadorId: ObjectId;
        date: Date;
        status: "Em Avaliação" | "Aceito" | "Recusado" | "Necessita de Alteração";
    }[];
    totalArquivos: number,
    tamanhoTotalBytes: number,
    dataAvaliacao?: string;
    avaliadorId?: ObjectId;
    configuracaoModalidade: IAcademicWorksProps["modalidades"][0];
}


