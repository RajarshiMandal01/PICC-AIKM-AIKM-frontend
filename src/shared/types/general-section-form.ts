import { Module } from "@/shared/types/module";
import { BbCompSpec, BuildingBlock, ComponentModel, ReqSpec } from "./building-block";
import { getFormattedDateTime } from "../utils";
export class GeneralSectionForm {
    title: string = "";
    repoGroup: string = "";
    repoSubGroup: string = "";
    repoUrl: string = "";
    repoUserId: string = "";

    static convertToGeneralSectionForm(data: Module): GeneralSectionForm {
        const form = new GeneralSectionForm();
        form.title = data.reqTitle;
        form.repoGroup = data.reqAcc;
        form.repoSubGroup = data.reqProj;
        const general_section_data = data.reqComp.find(comp => comp.bbComponent.compId === 'bbcomp_gen');
        const git_userid = general_section_data?.reqSpec.find(spec => spec.bbCompSpec.specid === 'git_userid');
        // form.repoName = data.reqDtl;
        const git_project = general_section_data?.reqSpec.find(spec => spec.bbCompSpec.specid === 'git_project');
        form.repoUrl = git_project?.specValue || "";
        form.repoUserId = git_userid?.specValue || "";
        return form;
    }

    static reconstructModuleWithGeneralSectionForm(form: GeneralSectionForm, module: Module): Module {
        const general_section_comp = module.reqComp.find(comp => comp.bbComponent.compId === 'bbcomp_gen');
        if(general_section_comp) {
            const git_userid_spec = general_section_comp.reqSpec.find(spec => spec.bbCompSpec.specid === 'git_userid');
            if(git_userid_spec) {
                git_userid_spec.specValue = form.repoUserId;
            }
            const git_project_spec = general_section_comp.reqSpec.find(spec => spec.bbCompSpec.specid === 'git_project');
            if(git_project_spec) {
                // const base_url = git_project_spec.specValue ? new URL(git_project_spec.specValue).origin : "";
                // git_project_spec.specValue = `${base_url}/${form.repoGroup}/${form.repoSubGroup}/${form.repoName}.git`;
                git_project_spec.specValue = form.repoUrl || "";
            }
        }

        // module.reqCapDT = module.reqCapDT || getFormattedDateTime();
        // module.reqComDT = module.reqComDT || getFormattedDateTime();
        // module.reqReSubDT = module.reqReSubDT || getFormattedDateTime();
        module.reqTitle = form.title;
        module.reqAcc = form.repoGroup;
        module.reqProj = form.repoSubGroup;
        // module.reqDtl = form.repoName;

        return module;
    }

    static createEmptyComponent(componentId: string, bb: BuildingBlock, reqSpecs: ReqSpec[]): ComponentModel{
        return {
            reqCompId: '',
            compStatDtl: '',
            compStatus: '',
            compComDT: getFormattedDateTime(),
            compLink: '',
            genRequired: false,
            compReSubDT: getFormattedDateTime(),
            reqSpec: reqSpecs,
            bbComponent: {
                compId: componentId,
                bbCompSpec: [],
                dependentComp: [],
                bb: {
                    bb_id: bb.bb_id,
                    bbName: bb.bbName,
                    bbDesc: bb.bbDesc,
                    bbStatus: bb.bbStatus,
                    bbItemseq: bb.bbItemseq,
                    bbComp: []
                }
            }
        } as ComponentModel;
    }

    static createSpec(spec: BbCompSpec, specValue: any): ReqSpec {
        return {
            reqSpecId: "",
            specValue: specValue,
            reqComponent: "",
            specid: spec.specid,
            bbCompSpec: spec,
            reqTmplValDtoList: [],
            apiReqSpecDtoList: [],
            yamlTemplateDtoList: [],
            components: [],
            orchestrationComponents: null,
            reqNoderedFlowsDtoList: [],
        };
    }

    static createInitialModule(signum: string, bbs: BuildingBlock[], reqSpecs: BbCompSpec[]): Module {
        const bb = bbs.find(b => b.bb_id === 'bb_gen');
        return {
            reqId: "",
            reqCapDT: new Date().toISOString(),
            reqComDT: new Date().toISOString(),
            reqReSubDT: new Date().toISOString(),
            reqStatDtl: "",
            reqStatus: "",
            reqSignum: signum,
            reqTitle: "",
            reqProj: "",
            reqAcc: "",
            reqDtl: "",
            reqComp: [
                this.createEmptyComponent('bbcomp_gen', bb, reqSpecs.map(spec => {
                    return this.createSpec(spec, spec.specid === "git_project" ? `${spec.gitLabUrl}` : "");
                }))
            ],
        } as Module;
    }
}