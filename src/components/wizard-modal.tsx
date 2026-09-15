
import { Alert, Step, StepLabel, Stepper } from '@mui/material';
import React, { useEffect, useCallback, useRef } from 'react';
import WizardElements from './wizard-elements';
import { LoggerService } from '@/services/logger.service';
import Editor from '@/widgets/editor';
import { YamlTemplateProvider, useYamlTemplateCtx } from '@/contexts/YamlTemplateContext';

export interface WizardModalProps {
    data?: {specName: string; yamlData: Record<string, any>} | null;
    onSave?: (data: Record<string, any>) => void;
}

export interface WizardData {
    id: string;
    type: 'object' | 'list' | 'array' | 'input';
    label: string;
    mandatory?: boolean;
    children?: WizardData[];
    inputType?: string;
    defaultValue?: any;
    readOnly?: boolean;
    helpText?: string;
    validations?: Record<string, any>;
    options?: { label: string; value: string }[];
    editor?: boolean
}

function WizardModalInner({ data, onSave }: WizardModalProps) {
    const ctx = useYamlTemplateCtx();
    const [mode, setMode] = React.useState<'wizard' | 'yaml'>('wizard');
    const [wizardData, setWizardData] = React.useState<WizardData[]>([]);
    const [activeStep, setActiveStep] = React.useState(0);
    const [yamlData, setYamlData] = React.useState<Record<string, any>>(data?.yamlData || {});
    const wizardDataRef = useRef<WizardData[]>([]);
    const activeStepRef = useRef<number>(0);

    // Keep refs in sync
    useEffect(() => {
        wizardDataRef.current = wizardData;
    }, [wizardData]);

    useEffect(() => {
        if(data?.specName === 'JMSConsumer'){
            if(yamlData?.module?.resourcelist?.length && !yamlData.module.resourcelist.every(r => r.queueconfig?.broker_type === ctx.brokerType)){
                setYamlData(prev => {
                    const updatedResourceList = prev.module.resourcelist.map((r: any) => ({
                        ...r,
                        queueconfig: {
                            ...r.queueconfig,
                            broker_type: ctx.brokerType
                        }
                    }));
                    return {
                        ...prev,
                        module: {
                            ...prev.module,
                            resourcelist: updatedResourceList
                        }
                    };
                }); 
            }
        }
    }, [ctx.brokerType, data?.specName]);

    useEffect(() => {
        activeStepRef.current = activeStep;
    }, [activeStep]);

    useEffect(() => {
        if (data?.specName) {
            getTemplate(data.specName);
        }
    }, [data?.specName]);

    const setDefaultValues = (wizard: WizardData): any => {
        if (wizard.type === 'object') {
            const obj: Record<string, any> = {};
            wizard.children?.forEach(child => {
                obj[child.id] = setDefaultValues(child);
            });
            return obj;
        } else if (wizard.type === 'list' || wizard.type === 'array') {
            if (wizard.type === 'list' && (wizard.id === 'propertyfiles')) {
                return ['application.properties'];
            }
            return [];
        }
        else if (wizard.inputType === 'textarea' && wizard.editor) {
            return JSON.stringify(wizard.defaultValue || {}, null, 2);
        }
        return wizard.defaultValue || "";
    };

    // Initialize with proper data structures based on wizard types, preserving existing data
    const createInitialYamlData = (wizards: WizardData[]) => {
        setYamlData(prev => {
                // Start with existing module data or empty object
                const existingModule = prev.module || {};
                const moduleData: Record<string, any> = { ...existingModule };

                LoggerService.info('WizardModal: Starting with existing module data:', existingModule);

                wizards.forEach(wizard => {
                    if (wizard.id === 'basic') {
                        // For basic step, initialize properties directly in module only if missing
                        if (wizard.children) {
                            wizard.children.forEach(child => {
                                if (moduleData[child.id] === undefined) {
                                    moduleData[child.id] = setDefaultValues(child);
                                }
                            });
                        }
                    } else {
                        // For other steps, initialize only if missing
                        if (moduleData[wizard.id] === undefined) {
                            moduleData[wizard.id] = setDefaultValues(wizard);
                        }
                    }
                });

                LoggerService.info('WizardModal: Final module data after initialization:', moduleData);

                const updatedYamlData = {
                    ...prev,
                    module: moduleData
                };
                if(updatedYamlData?.module?.broker_property?.broker_type !== ctx.brokerType){
                    ctx.updateBrokerType(updatedYamlData.module?.broker_property?.broker_type || '');
                }
                return updatedYamlData;
            });
    }; // Only depend on length, not the array itself

    // Stable callback using refs to avoid recreation
    const handleDataChange = useCallback((newData: any) => {
        const currentWizard = wizardDataRef.current[activeStepRef.current];
        if (!currentWizard) return;

        setYamlData(prev => {
            const newYamlData = { ...prev };
            if (!newYamlData.module) {
                newYamlData.module = {};
            }

            if (currentWizard.id === 'basic') {
                // For basic step, merge directly into module
                newYamlData.module = {
                    ...newYamlData.module,
                    ...newData
                };
            } else {
                // For other steps, store under wizard id
                newYamlData.module = {
                    ...newYamlData.module,
                    [currentWizard.id]: newData
                };
            }

            if (newYamlData?.module?.broker_property?.broker_type !== ctx.brokerType) {
                ctx.updateBrokerType(newYamlData.module?.broker_property?.broker_type || '');
            }

            return newYamlData;
        });
    }, []); // Empty dependency array - callback never recreates

    const getTemplate = async (specName: string) =>{
        const { default: template } = await import(`@/assets/json/${specName}.template.json`);

        for (let i = 0; i < template.module.elements.length; i++) {
            const element = template.module.elements[i];

            if (element.import) {
                const { default: partial } = await import(`@/assets/json/partials/${element.import}.partial.json`);
                template.module.elements[i] = partial; // Replace with partial
                LoggerService.info(`Loaded partial for ${element.import}:`, partial);
            }
        }
        LoggerService.info("TEMPLATE:", template);
        const wizards = generateWizard(template.module.elements);
        setWizardData(wizards);
        createInitialYamlData(wizards);
        LoggerService.info("Wizard Data:", wizards);
    }

    const generateWizard = (elements: any[]): WizardData[] => {
        const wizardData: WizardData[] = [];
        elements.forEach((element) => {
            const elementType = element['element-type'];
            const type = elementType === 'object' ? 'object' :
                        elementType === 'list' ? 'list' :
                        elementType === 'array' ? 'array' : 'input';

            const wizardItem: WizardData = {
                id: element.name,
                type,
                label: element.display,
                mandatory: element.mandatory || false,
                inputType: element['input-type'] || 'text',
            };

            // Add input-specific properties for input elements
            if (type === 'input') {
                wizardItem.defaultValue = element['default-val'] || element['def-val'] || '';
                wizardItem.readOnly = element['read-only'] || element.readonly || false;
                wizardItem.helpText = element['help-text'] || element.helpText || '';
                wizardItem.validations = element.validations?.reduce((acc: Record<string, any>, curr: any) => {
                    const key = Object.keys(curr)[0];
                    if(key == 'required'){
                        if(curr[key] === true){
                            acc[key] = `${wizardItem.label} is required`;
                        }
                    } else if(key == 'pattern'){
                        if(curr[key] === true){
                            acc[key] = {
                                value: new RegExp(curr['pattern-value']),
                                message: `${wizardItem.label} format is invalid`
                            };
                        }
                    } else {
                        acc[key] = curr[key];
                    }
                    return acc;
                }, {}) || {};
                wizardItem.editor = element.editor;
            }

            // Recursively process children for nested structures
            if (element.elements && element.elements.length > 0) {
                wizardItem.children = generateWizard(element.elements);
            }

            wizardData.push(wizardItem);
        });
        return wizardData;
    }

    const handleSave = () => {
        LoggerService.info('Final YAML Data to be saved:', yamlData);
        if(onSave) {
            onSave(yamlData);
        }
    }

    return (
        <div>
            <div className='h-[80vh]'>
                {mode === 'wizard' ? (
                    <div className='flex flex-col h-full space-y-4'>
                        <Stepper alternativeLabel activeStep={activeStep}>
                            {wizardData.map((step, index) => (
                                <Step key={step.id} completed={index < activeStep} onClick={() => setActiveStep(index)} style={{ cursor: 'pointer' }}>
                                    <StepLabel>{step.label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                        <div className='flex-1 min-h-0'>
                            {
                                (wizardData.length && wizardData[activeStep]) ? (() => {
                                    const currentWizard = wizardData[activeStep];
                                    const currentData = currentWizard.id === 'basic' ? yamlData.module : yamlData.module?.[currentWizard.id];

                                    return (
                                        <WizardElements
                                            data={currentData}
                                            wizard={currentWizard}
                                            onDataChange={handleDataChange}
                                            specName={data?.specName}
                                            parent={currentWizard.id}
                                        />
                                    );
                                })() : ''
                            }
                        </div>
                    </div>
                ) : (
                    <div className='flex flex-col h-full'>
                        <div className='flex items-center justify-between px-4 bg-[#888888] text-[#ffffcc] h-[50px]'>
                            <h2 className='text-sm font-semibold'>YAML View</h2>
                        </div>
                    
                        <div className='flex-1 min-h-0 p-4 bg-gray-50'>
                            <div className='flex  flex-col h-full space-y-4'>
                                <Alert severity="warning">
                                    It is not recommended to edit the YAML that is generated via the wizard, as no validation or yaml formatting is being done. Only edit the YAML if you have no other option, else please use the wizard.
                                </Alert>
                                <div className='flex-1 min-h-0 overflow-auto border border-gray-300 rounded'>
                                    <Editor className="!h-full !w-full" value={yamlData } mode="json" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className='flex justify-end space-x-2 mt-4'>
                <button className='nnp-btn nnp-btn-secondary' onClick={() => setMode(mode === 'wizard' ? 'yaml' : 'wizard')}>{mode === 'wizard' ? 'YAML' : 'Wizard'}</button>
                <button className='nnp-btn nnp-btn-primary' onClick={handleSave}>Save</button>
            </div>
        </div>
    )
}

// Wrapper component that provides the context
function WizardModal({ data, onSave }: WizardModalProps) {
    return (
        <YamlTemplateProvider 
            specName={data?.specName || ''} 
        >
            <WizardModalInner data={data} onSave={onSave} />
        </YamlTemplateProvider>
    );
}

export default WizardModal
