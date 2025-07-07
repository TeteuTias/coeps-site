export default interface IAcademicWorks {
    "data_inicio_submissao": string,
    "data_limite_submissao": string,
    "data_publicacao_resultados": string,
    "autores_por_trabalho": number,
    "trabalhos_por_usuario": number,
    "resultados": {
        link: string,
        titulo: string,
        data_publicacao: string
    }[],
    "link_edital": string,
    "isOpen": boolean
}

