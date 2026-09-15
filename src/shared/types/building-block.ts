export class BbCompSpec {
  specid: string;
  specName: string;
  specDesc: string;
  specvalidation: string;
  specdesc: string;
  specvalues: string;
  compstatus: string;
  dependentCompSpec: any[];
  templates: any[];
  devNodeRedURL: string | null;
  gitLabUrl: string;
  specLabel: string;

  constructor(specid: string = '') {
    this.specid = specid;
  }

}

interface BbInfo {
    name: string;
    display: string;
    type: string;
    formControl: string;
}


export interface BbComponent {
    bb?: BuildingBlock;
    compId: string;
    compName: string;
    compDesc: string;
    compStatus: string;
    compHelp: string;
    bbCompSpec: BbCompSpec[];
    dependentComp: any[];
}

export interface BuildingBlock {
    bb_id: string;
    bbName: string;
    bbDesc: string;
    bbStatus: string;
    bbItemseq: string;
    bbInfo: BbInfo[];
    bbComp: BbComponent[];
}

export interface ApiDTO{
  apiDesc: string | null,
  apiGroup: string | null,
  apiId: string,
  apiName: string | null
}
interface SampleJson{
  [key: string]: any
}

export interface ParamSpec{
  input: string,
  name: {
    paramName: string,
    paramType: string,
    annotations: {type: string}[]
  },
  output: {dataType: string},
  requestMapping: string
}
export interface ApiReqSpecDto{
  apiDto: ApiDTO,
  apiName: string,
  apiSchema: any,
  apiSpecId: string,
  paramc: ParamSpec | null,
  paramd: ParamSpec | null,
  paraml: ParamSpec | null,
  paramq: ParamSpec | null,
  paramu: ParamSpec | null,
  sampleJson: SampleJson | null
}

export interface ReqSpec {
  reqSpecId: string;
  specValue: string;
  reqComponent: any | null,
  specid: any | null,
  bbCompSpec: BbCompSpec;
  reqTmplValDtoList: any[]; // can be typed if structure is known
  apiReqSpecDtoList: ApiReqSpecDto[];
  yamlTemplateDtoList: any[];
  components: any[] | null;
  orchestrationComponents: any[] | null;
  reqNoderedFlowsDtoList: any[];
}
export interface ComponentModel {
  reqCompId: string;
  compComDT: string;
  compLink: string;
  compReSubDT: string;
  compStatDtl: string;
  compStatus: string;
  tmfRootApi: string | null;
  genRequired: boolean;
  reqSpec: ReqSpec[];
  bbComponent: BbComponent;
}