export interface Group{
    id: string;
    name: string;
    projects: {id: string; name: string}[];
}