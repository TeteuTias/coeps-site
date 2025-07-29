import { ObjectId } from "bson";
import { StatusTrabalho } from "./work.t";
import { WorkModality } from "./work.t";
import { Author } from "./author.t";

export interface AcademicWorkEvaluation {
    id: ObjectId;
    descricao: string;
    pontuacao: number;
    pontuacaoMaxima: number;
}
/**
* Representa a avaliação completa de um trabalho pela banca.
*/
export interface Evaluation {
    id: ObjectId;
    trabalhoId: ObjectId;
    avaliadorId: ObjectId;
    criterios: AcademicWorkEvaluation[];
    /** Campo para a banca adicionar uma justificativa ou observações. */
    justificativa?: string;
    /** Status definido pela banca após a correção. */
    status: StatusTrabalho;
    /** Prazo final para o reenvio do arquivo em caso de 'Correção de erros'. */
    prazoCorrecao?: Date;
    dataAvaliacao: Date;
}
/**
* Payload para a ação de alterar o status de um trabalho.
*/
export interface AlterarStatusPayload {
    trabalhoId: ObjectId;
    novoStatus: 'Aceito' | 'Recusado' | 'Correção de erros';
    /** Opcional: Definir um prazo em dias para a correção. */
    diasParaCorrecao?: number;
}
/**
* Payload para a ação de editar uma correção já submetida.
*/
export interface EditEvaluationPayload {
    avaliacaoId: ObjectId;
    novosCriterios: Evaluation[];
    novaJustificativa?: string;
}

//
//
export interface AcompanhamentoTrabalho {
    // Informações que o usuário enviou
    infoSubmissao: {
        titulo: string;
        resumo: string;
        modalidade: WorkModality;
        areaTematica: string;
        palavrasChave: string[];
        autores: Author[];
        arquivoUrl: string;
        dataSubmissao: Date;
    };
    // Status e feedback atual da banca
    status: StatusTrabalho;
    feedback?: {
        checklist: Evaluation[];
        justificativa?: string;
        prazoCorrecao?: Date;
    };
}