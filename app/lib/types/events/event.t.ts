export interface ICourse { // considere como MINICURSOS
    "_id": string & { readonly __brand: 'ObjectId' },
    "showToUser": boolean,
    "name": string,
    "description": string,
    "maxParticipants": number,
    "participantsCount": number,
    "participants": string & { readonly __brand: 'ObjectId' }[],
    "isFree": boolean,
    "timeline": {
        "_id": string & { readonly __brand: 'ObjectId' },
        "name": string,
        "date_init": string,
        "date_end": string,
        "description": string,
        "speakers": string & { readonly __brand: 'ObjectId' }[],
        "presence_list": string & { readonly __brand: 'ObjectId' }[],
        "local_description": string,
        "local": string,
        "_idPattern": string & { readonly __brand: 'ObjectId' }
    }[],
    "isOpen": boolean,
    "dateOpen": string,
    "type": string,
    "organization_name": string,
    "emoji": string,
    "value": number,
    "_nSerie": string & { readonly __brand: 'ObjectId' },
    "attendanceList": string & { readonly __brand: 'ObjectId' }[]
}

export interface ILecture { // considere como PALESTRAS
    "_id": string & { readonly __brand: 'ObjectId' },
    "showToUser": boolean,
    "name": string,
    "description": string,
    "timeline":
    {
        "_id": string & { readonly __brand: 'ObjectId' },
        "name": string
        "date_init": string,
        "date_end": string,
        "description": string,
        "speakers": string & { readonly __brand: 'ObjectId' }[], // pelo que lembre é uma lista de objectids 
        "presence_list": string & { readonly __brand: 'ObjectId' }[],
        "local": string,
        "local_description": string,
        "_idPattern": string & { readonly __brand: 'ObjectId' }
    }[]
    ,
    "type": string, //"TODOS", existe um tipo certo ??
    "organization_name": string,
    "emoji": string,
    "_nSerie"?: string & { readonly __brand: 'ObjectId' }, // isso daqui é muito mais para controle próprio, quando eu estava lançando com python marcava todos com nSerie para poder apagar/modificar se tivesse lançado errado!!!
    "isCertifiable": boolean
}