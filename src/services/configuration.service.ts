import { BbCompSpec } from "@/shared/types/building-block";
import ApiService from "./api.service";
import { Group } from "@/shared/types/group";
import { ComponentStatus } from "@/shared/types/component-status";
import { ApiModel } from "@/shared/types/api";
import { YamlInfo } from "@/shared/types/yaml-info";

const CONFIGURATION_URL = import.meta.env.VITE_CONFIGURATION_BASE_URL as string;

const GET_GROUPS = CONFIGURATION_URL + '/getGroups';
const GET_COMP_SPEC_BY_ID = CONFIGURATION_URL + '/getCompSpecOnCamp';
const GET_COMP_STATUS = CONFIGURATION_URL + '/getCodeGenStatus';
const GET_API_LIST = CONFIGURATION_URL + '/getApi';
const GET_ALL_YAML = CONFIGURATION_URL + '/getYamlMap';
const PUBLISH_COMPONENT = CONFIGURATION_URL + '/publish';


export const ConfigurationService = {
    getGroups: (username: string) => ApiService.get<Group[]>(`${GET_GROUPS}/${username}`),
    getCompSpec: (compId: string, reqAcc?: string) => {
        let url = `${GET_COMP_SPEC_BY_ID}/${compId}`;
        if(compId === 'bbcomp_api_ndeploy' || compId === 'bbcomp_api_orch_nr'|| compId === 'bbcomp_api_nconfig'||compId === 'bbcomp_iot_nconfig' || compId === 'bbcomp_iot'|| compId === 'bbcomp_iot_ndeploy'){
            url += `/${reqAcc}`;
        }
        return ApiService.get<BbCompSpec[]>(url);
    },

    getAllCompStatuses: (compId: string) => ApiService.get<ComponentStatus[]>(`${GET_COMP_STATUS}/${compId}`),
    getApiList: (componentId?: string) => {
        let url = GET_API_LIST;
        if (componentId) {
            url += `/${componentId}`;
        }
        return ApiService.get<ApiModel[]>(url);
    },
    getAllYaml: () => ApiService.get<Record<string, YamlInfo>>(GET_ALL_YAML),
    publishComponent: (body: { reqId: string; reqCompId: string }) => ApiService.post<ComponentStatus>(PUBLISH_COMPONENT, body)
}