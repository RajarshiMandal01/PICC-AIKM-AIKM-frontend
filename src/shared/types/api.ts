export interface ApiModel {
  apiCacheid: string | null;
  apiDesc: string;
  apiGroup: string;
  apiId: string;
  apiName: string;
  apiSchema: any;
  apiVersion: string;
  docNumber: string;
  odaDomain: string;
  paramc: boolean | null;
  paramd: boolean | null;
  paraml: boolean | null;
  paramq: boolean | null;
  paramu: boolean | null;
  praApiList: ApiModel[];
  prntId: string | null;
  sampleJson: Record<string, any> | null;
}

export interface ApiWithTopParent extends ApiModel {
    topParentId: string;
}