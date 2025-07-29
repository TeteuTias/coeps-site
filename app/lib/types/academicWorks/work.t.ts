export type WorkModality = 'Artigo' | 'Banner' | 'Resumo';
import { Author } from "./author.t";
/**
*/
export type StatusTrabalho =
    | 'Em avaliação'
    | 'Aceito'
    | 'Recusado'
    | 'Correção de erros';
// Define os possíveis status de um trabalho durante o processo de avaliação.
/*
* Interface principal para um trabalho científico submetido.
*/
export interface Trabalho {
    id: string;
    titulo: string;
    resumo: string;
    modalidade: WorkModality;
    areaTematica: string;
    palavrasChave: string[];
    autores: Author[];
    /** URL para o arquivo do trabalho submetido. */
    arquivoUrl: string;
    /** Data em que a submissão foi realizada. */
    dataSubmissao: Date;
    /** Status atual do trabalho no fluxo de avaliação. */
    status: StatusTrabalho;
    /** Bloqueia a edição do trabalho após o fim do prazo ou submissão final. */
    edicaoBloqueada: boolean;
}