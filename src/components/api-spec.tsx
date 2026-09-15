import { ConfigurationService } from "@/services/configuration.service";
import { ApiModel, ApiWithTopParent } from "@/shared/types/api";
import { ApiReqSpecDto, BbCompSpec, BuildingBlock, ComponentModel, ReqSpec } from "@/shared/types/building-block";
import { Module } from "@/shared/types/module";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useOutletContext, useParams } from "react-router-dom";
import ApiSpecTable from "./api-spec-table";
import { GeneralSectionForm } from "@/shared/types/general-section-form";
import SaveIcon from '@mui/icons-material/Save';
import { TransactionService } from "@/services/transation.service";
import DynamicForm from "@/widgets/dynamicForm";
import { useForm } from "react-hook-form";
import { InputConfig } from "@/shared/types/inputconfig";
import { LoggerService } from "@/services/logger.service";
import Modal from "@/widgets/modal";
import Editor from "@/widgets/editor";
import { toasterService } from "@/services/toaster.service";


function ApiSpec() {
  const { componentId } = useParams();
  const {module, buildingBlocks, onSubmit} = useOutletContext<{ 
    module: Module; 
    buildingBlocks: BuildingBlock[];
    onSubmit: (data: ComponentModel) => Promise<boolean>;
  }>();
  const [apiList, setApiList] = useState<ApiModel[]>([]);
  const [apiMapWithTopParent, setApiMapWithTopParent] = useState<Record<string, ApiWithTopParent>>({});
  const [ , setTopParentApiMap] = useState<Record<string, ApiModel>>({});
  const [savedApiSpec, setSavedApiSpec] = useState<Record<string, ApiReqSpecDto>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [ componentDetails, setComponentDetails] = useState<ComponentModel>(null);
  const formMethods = useForm({ mode: 'onChange' });
  const { getValues, formState: { isValid: formIsValid } } = formMethods;
  const [formData, setFormData] = useState<{inputs: InputConfig, values: Record<string, any>}>({inputs: [
    {
      label: 'App Name',
      name: 'app_name',
      helpText: '',
      validation:{
        required: 'App Name is required'
      },
      type: 'manualValidation',
      placeholder: 'Enter App Name',
      manualCheckValidatorFn: async (value: string) => {
        if (!value.trim()) return;
        try {
            const res = await TransactionService.validateAppName({
                accName: module.reqAcc,
                appName: value,
            });
            return res || 'Application name already exists. Please choose a different name.';
        } catch (err) {
            LoggerService.error('Error validating application name:', err);
            return 'Error validating application name. Please try again later.';
        }
      }
    }
  ], values: {}});
  const [infoModalData, setInfoModalData] = useState<ApiModel | null>(null);
  const [launchModalData, setLaunchModalData] = useState<ApiModel | ApiReqSpecDto | null>(null);

  useEffect(() => {
    if(componentId && module) {
      getSavedApiSpec();
      fetchApiList();
    }
  }, [componentId, module?.reqId]);

  const getSavedApiSpec = () => {
    let compDetails = module?.reqComp?.find(comp => comp.bbComponent.compId === componentId);
    if(compDetails) {
      const savedApiSpec = compDetails?.reqSpec[0].apiReqSpecDtoList.reduce((acc, curr) => {
        acc[curr.apiDto.apiId] = curr;
        return acc;
      }, {});
      setSavedApiSpec(savedApiSpec || {});
    } else {
      const buildingBlock = buildingBlocks.find(bb => bb.bbComp.some(comp => comp.compId === componentId)); 
      compDetails = GeneralSectionForm.createEmptyComponent(componentId, buildingBlock, [
        {
          specValue: "",
          bbCompSpec: new BbCompSpec("compspec_busj_api"),
          reqTmplValDtoList: [],
          apiReqSpecDtoList: [],
          yamlTemplateDtoList: []
        } as ReqSpec,
        {
          specValue: "true",
          bbCompSpec: new BbCompSpec("compspec_busj_regapi"),
          reqTmplValDtoList: [],
          apiReqSpecDtoList: [],
          yamlTemplateDtoList: []
        } as ReqSpec,
        {
          specValue: "",
          bbCompSpec: new BbCompSpec("compspec_busj_appnm"),
          reqTmplValDtoList: [],
          apiReqSpecDtoList: [],
          yamlTemplateDtoList: []
        } as ReqSpec
      ]);
      setSavedApiSpec({});
    }
    setFormData(prev => ({...prev, values: {'app_name': compDetails?.reqSpec?.[2]?.specValue || ''}}));
    setComponentDetails(compDetails);
  }

  const fetchApiList = () => {
    setLoading(true);
    ConfigurationService.getApiList(componentId).then(res => {
      setLoading(false);
      setApiList(res);
      generateMaps(res);
    }).catch(err => {
      setLoading(false);
      LoggerService.error('Error fetching API list:', err.message);
      toasterService.showError(err.message);
    });
  }

  const generateMaps = (apiList: ApiModel[]) => {
    const apiWithTopParentMap: Record<string, ApiWithTopParent> = {};
    const topParentMap: Record<string, ApiModel> = {};
    apiList.forEach(api => {
      topParentMap[api.apiId] = api;
      setTopParentMap(api.apiId, api, apiWithTopParentMap);
    });
    setApiMapWithTopParent(apiWithTopParentMap);
    setTopParentApiMap(topParentMap);
  }

  const setTopParentMap = (topParentId: string, api: ApiModel, apiMap: Record<string, ApiWithTopParent>) => {
    apiMap[api.apiId] = { ...api, topParentId };
    if(api.praApiList && api.praApiList.length > 0) {
      api.praApiList.forEach(childApi => {
        setTopParentMap(topParentId, childApi, apiMap);
      });
    }
  }

  const onRespChange = useCallback((resp: Record<string, ApiReqSpecDto>) => {
    setSavedApiSpec(resp);
    LoggerService.info('onRespChange', resp);
    LoggerService.info('componentDetails before update', componentDetails);
    const updatedComponentDetails = JSON.parse(JSON.stringify(componentDetails));
    updatedComponentDetails.reqSpec[0].apiReqSpecDtoList = Object.values(resp);
    setComponentDetails(updatedComponentDetails);
  }, [componentDetails]);

  const onFormSubmit = () => {
    if(!componentDetails) return;
    componentDetails.reqSpec[2].specValue = getValues()?.['app_name'] || '';
    setComponentDetails(componentDetails);
    onSubmit(componentDetails);
  }

  const onActionClick = (type: 'info' | 'launch', data: any) => {
    if(type === 'info') {
      setInfoModalData(data);
    } else if(type === 'launch') {
      // setLaunchModalData(data);
      if(savedApiSpec[data.apiId]) {
        setLaunchModalData(savedApiSpec[data.apiId])
      }
    }
  }

  const memoizedApiSpecTable = useMemo(() => (
    <ApiSpecTable
      apiList={apiList}
      resp={savedApiSpec}
      apiMapWithTopParent={apiMapWithTopParent}
      isDataLoading={loading}
      onRespChange={onRespChange}
      onActionClick={onActionClick}
    />
  ), [apiList, savedApiSpec, apiMapWithTopParent, loading, onRespChange]);

  return (
    <div className='flex flex-col h-full'>
      <h2 className='font-bold mb-4'>Api Specification</h2>
      <div className="mb-4">
        <DynamicForm inputs={formData.inputs} defaultValues={formData.values}  formMethods={formMethods} hideSubmitButton={true} />
      </div>
      <div className='flex-1 min-h-0 overflow-y-auto'>
        {memoizedApiSpecTable}
      </div>
      <div className='mt-4 flex justify-end'>
        <button disabled={!formIsValid} className={'nnp-btn ' + (formIsValid ? 'nnp-btn-primary' : 'nnp-btn-disabled !cursor-not-allowed')} onClick={onFormSubmit}><SaveIcon className='mr-1' /> Save</button>
      </div>
      <Modal isOpen={!!infoModalData} onClose={() => setInfoModalData(null)} title={infoModalData?.apiName} size="medium">
        <div className="space-y-2">
          <div><strong>Domain:</strong> {infoModalData?.odaDomain || 'N/A'}</div>
          <div><strong>Doc No:</strong> {infoModalData?.docNumber || 'N/A'}</div>
          <div><strong>Version:</strong> {infoModalData?.apiVersion || 'N/A'}</div>
          <div><strong>Description:</strong> {infoModalData?.apiDesc || 'N/A'}</div>
        </div>
      </Modal>
      <Modal isOpen={!!launchModalData} onClose={() => setLaunchModalData(null)} title={launchModalData?.apiName} size="medium">
        <Editor value={launchModalData?.apiSchema} mode="json" className="!w-full" />
      </Modal>
    </div>
  )
}

export default ApiSpec
