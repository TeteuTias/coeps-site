import { ObjectId } from "bson";
/**
* Representa um autor, co-autor ou orientador do trabalho.
*/
export interface Author {
    nomeCompleto: string;
    cpf: string;
    email: string;
    /** Identifica se este participante é um orientador. */
    isOrientador: boolean;
    /** Identifica se este participante é o pagante inscrito no evento. */
    userId?: ObjectId;
}