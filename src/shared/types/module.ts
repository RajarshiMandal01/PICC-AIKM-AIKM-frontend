import { ComponentModel } from "./building-block";
export interface Module {
  reqId: string;
  reqAcc: string | null;
  reqCapDT: string;       // ISO date string
  reqComDT: string;       // ISO date string
  reqDtl: string | null;
  reqProj: string;
  reqReSubDT: string;     // ISO date string
  reqSignum: string;
  reqStatDtl: string | null;
  reqStatus: string;
  reqTitle: string;
  compPageId: string | null;
  reqComp: ComponentModel[];      
}
