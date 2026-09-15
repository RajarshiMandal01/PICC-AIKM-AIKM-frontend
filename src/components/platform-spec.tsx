import { ConfigurationService } from '@/services/configuration.service';
import { BbCompSpec, BuildingBlock, ComponentModel } from '@/shared/types/building-block';
import { GeneralSectionForm } from '@/shared/types/general-section-form';
import { Module } from '@/shared/types/module';
import DynamicForm from '@/widgets/dynamicForm';
import React, { useEffect } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import * as BTNCONF from '@/assets/json/buttonConfig.json';
import { useForm } from 'react-hook-form';
import SaveIcon from '@mui/icons-material/Save';
import LaunchIcon from '@mui/icons-material/Launch';
import AddIcon from '@mui/icons-material/Add';
import { TransactionService } from '@/services/transation.service';
import Modal from '@/widgets/modal';
import WizardModal from './wizard-modal';
import { BaseField } from '@/shared/types/inputconfig';
import { LoggerService } from '@/services/logger.service';
import { YamlInfo } from '@/shared/types/yaml-info';
import { toasterService } from '@/services/toaster.service';

function PlatformSpec() {
  const { componentId } = useParams();
  const navigate = useNavigate();
  const {module, buildingBlocks, onSubmit} = useOutletContext<{ 
    module: Module; 
    buildingBlocks: BuildingBlock[];
    onSubmit: (data: ComponentModel) => Promise<boolean>;
  }>();
  const [formData, setFormData] = React.useState({inputs: [], values:{} as Record<string, any>});
  const [componentDetails, setComponentDetails] = React.useState<ComponentModel>(null);
  const [buttonConfig, setButtonConfig] = React.useState(BTNCONF);
  const [nodeRedUrl, setNodeRedURL] = React.useState('');
  const [wizardModalInfo, setWizardModalInfo] = React.useState({isOpen: false, title: '', data: null});
  const formMethods = useForm({ mode: 'onChange' });
  const { getValues, formState: { isValid: formIsValid } } = formMethods;
  const [yamlMap, setYamlMap] = React.useState<Record<string, YamlInfo>>({});
  const patterns = {
    groupId: /^(?!.*\.\.)[a-z]+(?:\.[a-z]+)*$/,
    artifactId: /^(?!.*--)[a-z]+(?:-[a-z]+)*$/,
    version: /^(?![.])([0-9]+(?:[.][0-9]+)*)(?:[-.]SNAPSHOT)?(?![[0-9].])$/,
    app_name: /^(?!.*--)[a-z][a-z0-9-]*$/,
  };

  useEffect(() => {
    ConfigurationService.getAllYaml().then(res => {
      LoggerService.info('Fetched YAML map:', res);
      setYamlMap(res || {});
    }).catch(err => {
      LoggerService.error('Error fetching YAML map:', err.message);
      toasterService.showError(err.message);
    });
  }, []);

  useEffect(() => {
    if (componentId && module) {
      getComponentDetails(componentId, module.reqAcc);
    }
  }, [componentId, module]);

  const getComponentDetails = (compId: string, reqAcc?: string) => {
    ConfigurationService.getCompSpec(compId, reqAcc).then(res => {
      if(compId === 'bbcomp_api_orch_nr' || compId === 'bbcomp_iot'){
        setNodeRedURL(res[0]['devNodeRedURL']);
      }
      processComponentDetails(res);
      generateFormData(res)
      modifyInitialButtonConfig();
    }).catch(err => {
      LoggerService.error('Error fetching component details:', err.message);
      toasterService.showError(err.message);
    });
  }

  const  processComponentDetails = (specs: BbCompSpec[]) => {
    const compDetails = module?.reqComp?.find(comp => comp.bbComponent.compId === componentId);
    if(compDetails) {
      setComponentDetails(compDetails);
    } else {
      const bb = buildingBlocks.find(bb => bb.bbComp.some(comp => comp.compId === componentId));
      if(!bb) {
        LoggerService.error('Building block not found for component:', componentId);
        return;
      }
      setComponentDetails(
        GeneralSectionForm.createEmptyComponent(componentId, bb, specs.map(spec => {
            return GeneralSectionForm.createSpec(spec, spec.specid === "git_project" ? `${spec.gitLabUrl}` : "");
        }))
      )
    }
  }

  const multipleCheckboxCallbackFn = (selectedOption: string, selectedField: BaseField) => {
    const data = {specName: selectedOption, yamlData: '', reqSpecId: ''};
    setComponentDetails(currentDetails => { //closure issue fix
      const selectedSpec = currentDetails?.reqSpec?.find(spec => spec.bbCompSpec.specName === selectedField.name);
      if(selectedSpec){
        data.yamlData= JSON.parse(selectedSpec.yamlTemplateDtoList.find(y => y.yamlTemplateName == selectedOption)?.yamlTemplateContent || '{}');
        data.reqSpecId = selectedSpec.reqSpecId;
      }
      setWizardModalInfo({isOpen: true, title: selectedOption, data});
      return currentDetails;
    });
  }

  const saveYamlData = (data: Record<string, any>) => {
    setComponentDetails(currentDetails => { //closure issue fix
      const updatedSpec = currentDetails?.reqSpec?.map(spec => {
        if(spec.bbCompSpec.specid === "cspec_ms_modtyp") {
          const existingYaml = spec.yamlTemplateDtoList.find(y => y.yamlTemplateName === wizardModalInfo.data.specName);
          if(existingYaml) {
            existingYaml.yamlTemplateContent = JSON.stringify(data, null, 2);
          } else {
            const yamlInfo = yamlMap[ wizardModalInfo.data.specName];
            if(!yamlInfo){
              LoggerService.error('YAML info not found for:', wizardModalInfo.data.specName);
              return spec;
            }
            spec.yamlTemplateDtoList.push({
              yamlTemplateName: yamlInfo.yamlTemplateName,
              yamlTemplateId: yamlInfo.yamlTemplateId,
              yamlTemplateDescription: yamlInfo.yamlTemplateDescription,
              yamlTemplateContent: JSON.stringify(data, null, 2)
            });
          }
        }
        return spec;
      });
      return {...currentDetails, reqSpec: updatedSpec};
    });
    setWizardModalInfo({isOpen: false, title: '', data: null});
  }

  const generateFormData = (specs: BbCompSpec[]) => {
    const componentResp = module?.reqComp?.find(comp => comp.bbComponent.compId === componentId);
      let inp = [];
      let val = {};
      specs.forEach(comp => {
        const specResp = componentResp?.reqSpec?.find(spec => spec.bbCompSpec.specid === comp.specid);
        const label = comp.specLabel || comp.specName;
        const input = {
          label: label,
          name: comp.specName,
          helpText: comp.specdesc || '',
          validation:{
            required: comp.specvalidation === 'mandatory' ? `${label} is required` : false,
          },
          disabled: false
        }
        if(patterns[comp.specName]){
          input.validation['pattern'] = {
            value: patterns[comp.specName],
            message: `Invalid ${label} format`
          }
        }
        let currentInputValue: any = specResp?.specValue || '';
        if(comp.specDesc === 'cb' || comp.specDesc === 'wz-cb' || comp.specDesc === 'iot-cb' || comp.specDesc === 'iotncnf-cb') {
          const values = (specResp?.specValue || '').split('|');
          currentInputValue = values.reduce((acc, curr) => ({...acc, [curr]: true}), {});
        }
        if(comp.specDesc === 'cb-basic') {
          currentInputValue = currentInputValue === 'true' ? true : false;
        }
        val = {...val, [comp.specName]: currentInputValue};
        switch(comp.specDesc){
          case 'dv':
          case 'nm':
            if( comp.specName === 'app_name' && componentResp) {
              input.disabled = true;
            }
            inp = [...inp, {...input, type: (comp.specName === 'app_name' ? 'manualValidation' : 'text'), placeholder: `Enter ${label}`, manualCheckValidatorFn: comp.specName === 'app_name' ? async (value: string) => {
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
              } : null}];
          break;

          case 'pw' :
            if(comp.specid === 'git_password' ) 
              break;
            inp = [...inp, {...input, type: 'password', placeholder: `Enter ${label}`}];
          break;

          case 'cb-basic' :
            if(input.validation?.required){
              input.validation.required = false; //checkbox with mandatory doesn't make sense
            }
            inp = [...inp, {...input, type: 'checkbox'}];
          break;

          case 'cb':
          case 'wz-cb':{
            let checkboxInput: any = {...input, type: 'multipleCheckbox', options: comp.specvalues.split('|').map(opt => ({label: opt, value: opt, disabled: opt === 'Assembler'}))};
            if(comp.specDesc === 'wz-cb'){
              checkboxInput = {...checkboxInput, multipleCheckboxCallbackFn: multipleCheckboxCallbackFn};
            }
            inp = [...inp, checkboxInput];
          }
          break;

          case 'iot-cb' :
          case 'iotncnf-cb':
          {
            const specvalues = JSON.parse(comp.specvalues || '{}');
            const options = Object.entries(specvalues).map(([key, value]) => ({
              value: key,
              label: value
            }));

            inp = [...inp, {...input, type: 'multipleCheckbox', options}];
          }
          break;

          case 'mc' :
            inp = [...inp, {...input, type: 'select', options: comp.specvalues.split('|'), placeholder: `Select ${label}`}];
          break;

          case 'default':
            inp = [...inp, {...input, type: 'text', placeholder: label}];
          break;
        }
      })
      setFormData({inputs: inp, values: val});
  }

  const modifyInitialButtonConfig = () => {
    const updateButtonConfig = JSON.parse(JSON.stringify(buttonConfig));
      module.reqComp.forEach((comp) => {
        if(comp.bbComponent.compId === componentId) {
          comp.reqSpec.forEach((spec) => {
            if(spec.bbCompSpec.specid === buttonConfig[componentId]?.launch?.spec?.id) {
              if((spec.specValue === buttonConfig[componentId]?.launch?.spec?.value || buttonConfig[componentId]?.launch?.spec?.value === 'all')  && (spec.reqSpecId !== '')) {
                updateButtonConfig[componentId].launch.hidden = false;
                if(spec.bbCompSpec.specid === "cspec_api_orch_2" || spec.bbCompSpec.specid === "cspec_iot_3"){
                  updateButtonConfig[componentId].save.hidden = true;
                  updateButtonConfig[componentId].next.hidden = false;
                }
              } else if(spec.reqSpecId == '' || spec.specValue === '') {
                updateButtonConfig[componentId].launch.hidden = true;
              } else if(spec.specValue == 'basic' || spec.specValue == 'nuik') {
                updateButtonConfig[componentId].launch.hidden = false;
              }
            }
          })
        }
      });
      setButtonConfig(updateButtonConfig);
  }

  const modifyButtonConfigAfterSave = () => {
    const updateButtonConfig = JSON.parse(JSON.stringify(buttonConfig));
    module.reqComp.forEach((comp) => {
      if(comp.bbComponent.compId === componentId) {
        comp.reqSpec.forEach((spec) => {
          if(spec.specValue === 'basic' || spec.specValue === 'nuik'){
              buttonConfig[componentId].launch.hidden = false;
          } else if(componentId === 'bbcomp_api_orch_nr'){
            buttonConfig[componentId].launch.hidden = false;
            buttonConfig[componentId].next.hidden = false;
          }
          else if(componentId === 'bbcomp_iot'){
            buttonConfig[componentId].launch.hidden = false;
            buttonConfig[componentId].next.hidden = false;
          }
        });
      }
    });
    setButtonConfig(updateButtonConfig);
  }

  const onFormSubmit = () => {
    const requiredSpecs = [];
    const values = getValues();
    componentDetails.reqSpec.forEach(spec => {
      let value;
      if(spec.bbCompSpec.specDesc === 'cb' || spec.bbCompSpec.specDesc === 'wz-cb' || spec.bbCompSpec.specDesc === 'iot-cb' || spec.bbCompSpec.specDesc === 'iotncnf-cb') {
        Object.entries(values[spec.bbCompSpec.specName] || {}).forEach(([key, val]) => {
          if(val) {
            if(value) {
              value += `|${key}`;
            } else {
              value = key;
            }
          }
        });
      } else {
        value = values[spec.bbCompSpec.specName];
      }
      if(value !== undefined && value !== null){
        requiredSpecs.push({...spec, specValue: value});
      }
    });
    const updatedComponent: ComponentModel = {...componentDetails, reqSpec: requiredSpecs};
    setComponentDetails(updatedComponent);
    if(onSubmit) {
      onSubmit(updatedComponent).then(success => {
        if(success) {
          modifyButtonConfigAfterSave();
        }
      });
    }
  }

  const openTarget = () => {
    if(componentId === 'bbcomp_api_orch_nr' || componentId === 'bbcomp_iot'){
      let targetUrl: string = buttonConfig[componentId]?.launch?.url;
      LoggerService.info(targetUrl);
      targetUrl = targetUrl.replace('$src_node_red_url', nodeRedUrl);
      LoggerService.info(targetUrl);
      window.open(targetUrl, '_blank');
    }else{
      let targetUrl:string = buttonConfig[componentId]?.launch?.url;
      targetUrl = targetUrl.replace('$dndUrl',import.meta.env.VITE_DND_URL);
      targetUrl = targetUrl.replace('$attDndUrl',import.meta.env.VITE_ATT_DND_URL);
      targetUrl = targetUrl.replace('$reqId',module?.reqId);
      targetUrl = targetUrl.replace('$uxTemplate', formData.values.uxTemplate);
      targetUrl = targetUrl.replace('$selectedComp', componentId);
      targetUrl = targetUrl.replace('$src_node_red_url',import.meta.env.VITE_SRC_NODE_RED_URL);
      window.open(targetUrl, '_blank');
    }
  }


  return (
    <div className='flex flex-col h-full'>
      <h2 className='font-bold mb-4'> Platform Specification</h2>
      <div className='flex-1 min-h-0 overflow-y-auto'>
        {
          componentDetails && formData.inputs.length > 0 && <DynamicForm inputs={formData.inputs} defaultValues={formData.values} formMethods={formMethods} layout='double' hideSubmitButton={true} />
        }
      </div>
      <div className='mt-4 flex justify-end'>
        {
          !buttonConfig[componentId]?.prev?.hidden &&
          <button className='nnp-btn nnp-btn-secondary mr-2' onClick={() => {
            const url = buttonConfig[componentId]?.prev?.url;
            if(url){
              navigate(url.replace('$reqId', module?.reqId));
            }
          }}>
            Previous
          </button>
        }
        {
          !buttonConfig[componentId]?.save?.hidden &&
          <button disabled={!formIsValid} className={'nnp-btn ' + (formIsValid ? 'nnp-btn-primary' : 'nnp-btn-disabled !cursor-not-allowed')} onClick={onFormSubmit}><SaveIcon className='mr-1' /> Save</button>
        }
        {
          !buttonConfig[componentId]?.deploy?.hidden &&
          <button className='nnp-btn nnp-btn-primary ml-2' onClick={onFormSubmit}>Deploy</button>
        }
        {
          !buttonConfig[componentId]?.launch?.hidden &&
          <button className='nnp-btn nnp-btn-secondary ml-2' onClick={openTarget}><LaunchIcon className='mr-1' /> Launch</button>
        }
        {
          !buttonConfig[componentId]?.add?.hidden &&
          <button className='nnp-btn nnp-btn-secondary ml-2'><AddIcon className='mr-1' /> Add Node</button>
        }
        {
          !buttonConfig[componentId]?.next?.hidden &&
          <button className='nnp-btn nnp-btn-secondary ml-2' onClick={() => {
            const url = buttonConfig[componentId]?.next?.url;
            if(url){
              navigate(url.replace('$reqId', module?.reqId));
            }
          }}>
            Next
          </button>
        }
      </div>
      <Modal isOpen={wizardModalInfo.isOpen} onClose={() => setWizardModalInfo({title: '', isOpen: false, data: null})} title={wizardModalInfo.title} size='large'>
        <WizardModal data={wizardModalInfo.data} onSave={saveYamlData} />
      </Modal>
    </div>
  )
}

export default PlatformSpec
