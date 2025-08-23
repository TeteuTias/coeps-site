import { ObjectId } from "bson"


export interface IAcademicWorksProps {
    "data_inicio_submissao": string,
    "data_limite_submissao": string,
    "data_publicacao_resultados": string,
    //"autores_por_trabalho": number, 
    //"trabalhos_por_usuario": number, 
    // ambos os comentados acima, ainda estão no banco de dados. Tirei aqui porque provavelmente vão pedir pra gente fazer isso de uma forma dinâmica de acordo com o tipo de trabalho!!!
    "resultados": {
        link: string,
        titulo: string,
        data_publicacao: string
    }[],
    "link_edital": string,
    "modalidades"?: { // Coloquei como opcional pois pode acontecer de apaguarem todas as modalidades
        _id: ObjectId,
        modalidade: string,
        autores_por_trabalho: number,
        trabalhos_por_usuario: number,
        maximo_orientadores: number,
    }[]
    "isOpen": boolean
}
export interface IAcademicWorks {
    userId: ObjectId,
    titulo: string,
    modalidade: string,
    configuracaoTrabalho: IAcademicWorksProps["modalidades"][0], // vamos gravar a configuracão inicial do trabalho;
    autores: {
        nome: string,
        email: string,
        cpf: string
        isOrientador: boolean,
    }[],
    arquivo: {
        fileId: ObjectId,
        fileName: string,
        url: string,
    },
    topicos: {
        resu: string,
        intro: string,
        obj: string,
        met: string,
        disc: string,
        conc: string,
        pchave: string,
        ref: string,
    } | null,
    status: "Em Avaliação" | "Aceito" | "Recusado" | "Correção de Erros",
    dataSubmissao: Date,
    avaliadorComentarios: string[]
}
