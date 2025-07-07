export interface IConferenceProceedings {
    "_id": string & { readonly __brand: 'ObjectId' },
    "date_update": string,
    "name": string,
    "link": string
}