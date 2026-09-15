import React, { useCallback, useEffect, useMemo, useLayoutEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { WizardData } from './wizard-modal';
import { Alert, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DynamicForm from '@/widgets/dynamicForm';
import { BaseField } from '@/shared/types/inputconfig';
import DeleteIcon from '@mui/icons-material/Delete';
import * as BOOLEAN_TEMPLATE from '@/assets/json/boolean.template.json';
import * as PACKAGING_TEMPLATE from '@/assets/json/packaging.template.json';
import * as MODULETYPE_TEMPLATE from '@/assets/json/moduletype.template.json';
import * as BROKER_TEMPLATE from '@/assets/json/broker.template.json';
import * as ACK_MODE_TEMPLATE from '@/assets/json/ack_mode.template.json';
import * as DELIVERY_MODE_TEMPLATE from '@/assets/json/delivery_mode.template.json';
import * as TYPE_TEMPLATE from '@/assets/json/type.template.json';
import * as ACK_MODE_CONSUMER_TEMPLATE from '@/assets/json/ack_mode_consumer.template.json';
import * as ENTITY_GENERATION_STRATEGY_TEMPLATE from '@/assets/json/entity-generation-strategy.template.json';
import * as EXCEPTION_CLASS_NAMES_TEMPLATE from '@/assets/json/entity-exception.template.json';
import * as TRANSACTIONAL_TEMPLATE from '@/assets/json/transactional.template.json';
import * as METHOD_TYPE_TEMPLATE from '@/assets/json/method-type.template.json';
import * as FEATURE_TEMPLATE from '@/assets/json/feature.template.json';
import * as CHANNELS_TEMPLATE from '@/assets/json/partials/spring-integration-config.partial.json';
import * as BROKER_TYPE_TEMPLATE from '@/assets/json/broker_type.template.json';
import * as DATABASE_TYPE_TEMPLATE from '@/assets/json/entity-database-type.template.json';
import { LoggerService } from '@/services/logger.service';
import { useYamlTemplateCtx, YamlTemplateContextType } from '@/contexts/YamlTemplateContext';

// Type definitions
interface WizardElementsProps {
    data: any;
    wizard: WizardData;
    onDataChange?: (data: any) => void;
    specName?: string;
    path?: string;
    parent?: string;
}

// Utility functions

const getOptions = (templateName: string, specName?: string, dynamicOptions?: YamlTemplateContextType, parentName?: string) => {
    switch (templateName) {
        case 'pubsub':
        case 'remove_typeheaders':
        case 'exp_backoff':
        case 'dlq_required':
        case 'dlq':
        case 'ignoreSendFailures':
        case 'applySequence':
        case 'durable':
        case 'exclusive':
        case 'autodelete':
        case 'publisher_confirm':
        case 'publisher_return':
        case 'retry_enabled':
            return BOOLEAN_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name }));
        case 'moduletype':
            return MODULETYPE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name }));
        case 'packaging':
            return PACKAGING_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name }));
        case 'channels':
        case 'inputChannel':
        case 'outputChannel':
        case 'recipientChannels':
            return CHANNELS_TEMPLATE.elements[0].elements.map((val) => ({ label: val.name, value: val.name}));
        case 'methodtype':
            return METHOD_TYPE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'feature':
            return FEATURE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'transactional':
            return TRANSACTIONAL_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'associatedTopic':
            return dynamicOptions?.topics || [];
        case 'extends':
            return EXCEPTION_CLASS_NAMES_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'entityGenerationStrategy':
            return ENTITY_GENERATION_STRATEGY_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'type':{
            if(specName === 'JMSPublisher'  && parentName !== 'requests'){
                return TYPE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
            } else if(specName === 'Entity'){
                return DATABASE_TYPE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
            } else if(parentName === 'requests' ){
                return dynamicOptions?.models || [];
            }
            return [];
        }
        case 'ack_mode': {
            const d = specName === 'JMSConsumer' ? ACK_MODE_CONSUMER_TEMPLATE : ACK_MODE_TEMPLATE;
            return d.values.map((val) => ({ label: val.name, value: val.name}));
        }
        case 'broker_type':
            return BROKER_TYPE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'delivery_mode':
            return DELIVERY_MODE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'datatype':
            return TYPE_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'broker':
            return BROKER_TEMPLATE.values.map((val) => ({ label: val.name, value: val.name}));
        case 'modulename':
            return [];
        case 'resource':
            return [];
        case 'serviceName':
            return [];
        case 'northboundMethod':
            return [];
        case 'southboundMethods':
            return [];
        case 'expclass':
        case 'exceptions':
            return dynamicOptions?.exceptions || [];
        case 'repositories':
            return dynamicOptions?.repositories || [];
        case 'messageClass':
        case 'mappingModel':
        case 'modelFirst':
        case 'jsonmodel':
            return dynamicOptions?.models || [];
        default:
            return [];
    }
}

const initializeItem = (children: WizardData[], ctx: YamlTemplateContextType, parentName: string): Record<string, any> => {
    const item: Record<string, any> = {};

    children.forEach(child => {
        switch (child.type) {
            case 'input':
                if(ctx.specName === 'JMSConsumer' && parentName === 'queueconfig' && child.id === 'broker_type'){
                    item[child.id] = ctx.brokerType;
                }
                else if(child.inputType === 'textarea' && child.editor){
                    item[child.id] = JSON.stringify(child.defaultValue || {}, null, 2);
                } else {
                    item[child.id] = child.defaultValue || '';
                }
                break;
            case 'object':
                item[child.id] = {};
                if(child.children?.length){
                    item[child.id] = initializeItem(child.children, ctx, child.id); //for nested objects
                }
                break;
            case 'array':
            case 'list':
                item[child.id] = [];
                break;
            default:
                item[child.id] = null;
        }
    });

    return item;
};

const getFormInputType = (wizard: WizardData): string => {
    if(wizard.inputType === 'string'){
        return 'text';
    } else if(wizard.inputType === 'textarea' && wizard.editor) {
        return 'json';
    }
    return wizard.inputType || 'text';
};

// Component implementations
const ObjectWizard = React.memo<{
    wizard: WizardData;
    data: Record<string, any>;
    onDataChange?: (data: Record<string, any>) => void;
    specName?: string;
    path?: string;
}>(({ wizard, data = {}, onDataChange, specName, path = '' }) => {
    const dynamicOptions = useYamlTemplateCtx();
    const dataRef = useRef(data);
    const onDataChangeRef = useRef(onDataChange);
    const lastEmittedDataRef = useRef<string>('');

    // Update refs when props change
    useEffect(() => {
        dataRef.current = data;
        onDataChangeRef.current = onDataChange;
    }, [data, onDataChange]);

    if (!wizard.children?.length) return null;

    // Create form inputs for input type children
    const formInputs = useMemo(() => {
        return wizard.children
            ?.filter(child => child.type === 'input')
            .map(child => ({
                id: child.id,
                name: child.id,
                label: child.label,
                type: getFormInputType(child),
                placeholder: `Enter ${child.label}`,
                disabled: child.readOnly || false,
                helpText: child.helpText || '',
                options: child.inputType === 'select' ? getOptions(child.id, specName, dynamicOptions, wizard.id) : [],
                validation: child.validations || {}
            } as BaseField)) || [];
    }, [wizard.children, specName, dynamicOptions]);

    // Initialize form with current data or defaults
    const formData = useMemo(() => {
        const initialData: Record<string, any> = {};
        wizard.children?.forEach(child => {
            if (child.type === 'input') {
                initialData[child.id] = data[child.id] !== undefined
                    ? data[child.id]
                    : (child.defaultValue || '');
            }
        });
        return initialData;
    }, [data, wizard.children]);

    const form = useForm({
        mode: 'onChange',
        defaultValues: formData
    });

    // Watch for form changes and update parent with debounce
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const subscription = form.watch((value) => {
            if (!onDataChangeRef.current) return;

            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                // Merge form data with existing non-input data
                const updatedData = { ...dataRef.current };
                Object.keys(value).forEach(key => {
                    if (value[key] !== undefined) {
                        updatedData[key] = value[key];
                    }
                });

                // Check if data actually changed by comparing JSON
                const newDataJson = JSON.stringify(updatedData);
                if (newDataJson === lastEmittedDataRef.current) {
                    return;
                }

                lastEmittedDataRef.current = newDataJson;
                onDataChangeRef.current(updatedData);
            }, 300);
        });
        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, [form]);

    const handleNestedChange = useCallback((childId: string, childData: any) => {
        if (onDataChangeRef.current) {
            onDataChangeRef.current({ ...dataRef.current, [childId]: childData });
        }
    }, []);

    return (
        <>
            {wizard.id === 'databaseDetails' && (
                <Alert severity="warning" className='mb-4'>
                    Please make sure to create the database prior to saving this module and generating.
                </Alert>
            )}
            {formInputs.length > 0 && (
                <DynamicForm
                    inputs={formInputs}
                    formMethods={form}
                    defaultValues={formData}
                    layout='double'
                    hideSubmitButton={true}
                />
            )}
            {/* Render nested objects/arrays */}
            {wizard.children?.filter(child => child.type !== 'input').map(child => (
                <div key={child.id} className='mt-4'>
                    <WizardElementsInner
                        data={data[child.id]}
                        wizard={child}
                        onDataChange={(childData) => handleNestedChange(child.id, childData)}
                        specName={specName}
                        path={`${path}/${wizard.id}`}
                        parent={wizard.id}
                    />
                </div>
            ))}
        </>
    );
});


// Simple controlled component without form watching
const ListItem = React.memo<{
    item: string;
    index: number;
    wizard: WizardData;
    onUpdate: (index: number, value: string) => void;
    onRemove: (index: number) => void;
    specName?: string;
}>(({ item, index, wizard, onUpdate, onRemove, specName }) => {
    const dynamicOptions = useYamlTemplateCtx();
    const initialValue = item !== undefined && item !== null ? item : (wizard.defaultValue || '');
    const [value, setValue] = React.useState(initialValue);

    // Update local state when item prop changes
    useEffect(() => {
        const newValue = item !== undefined && item !== null ? item : (wizard.defaultValue || '');
        setValue(newValue);
    }, [item, wizard.defaultValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
        onUpdate(index, newValue);
    };

    const options: { label: string; value: string }[] = wizard.inputType === 'select' ? getOptions(wizard.id, specName, dynamicOptions) : [];

    return (
        <div className='border p-4 rounded bg-white'>
            <div className='flex justify-between items-center mb-2'>
                <span className='text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded'>
                    {wizard.label} #{index + 1}
                </span>
                <button
                    className='nnp-btn bg-red-100 text-red-600 hover:text-red-800 flex items-center gap-1'
                    onClick={() => onRemove(index)}
                >
                    <DeleteIcon fontSize='small' /> Remove
                </button>
            </div>
            <div className='mb-4'>
                {/* <label className='block text-sm font-medium mb-1'>{wizard.label}</label> */}
                {wizard.inputType === 'select' ? (
                    <select
                        value={value}
                        onChange={handleChange}
                        className='w-full p-2 border rounded'
                        disabled={wizard.readOnly}
                        {...wizard.validations}
                    >
                        <option value="">Select {wizard.label}</option>
                        {options?.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={wizard.inputType || 'text'}
                        value={value}
                        onChange={handleChange}
                        placeholder={`Enter ${wizard.label}`}
                        className='w-full p-2 border rounded'
                        disabled={wizard.readOnly}
                        {...wizard.validations}
                    />
                )}
                {wizard.helpText && (
                    <p className='text-sm text-gray-600 mt-1'>{wizard.helpText}</p>
                )}
            </div>
        </div>
    );
});

const ListWizard = React.memo<{
    wizard: WizardData;
    data: string[];
    onDataChange?: (data: string[]) => void;
    specName?: string;
}>(({ wizard, data = [], onDataChange, specName }) => {

    const handleUpdate = useCallback((index: number, value: string) => {
        if (onDataChange) {
            const newData = [...data];
            newData[index] = value;
            onDataChange(newData);
        }
    }, [onDataChange, data]);

    const handleRemove = useCallback((index: number) => {
        if (onDataChange) {
            onDataChange(data.filter((_, i) => i !== index));
        }
    }, [onDataChange, data]);

    return (
        <div className='space-y-4'>
            {data.length === 0 ? (
                <div className='text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg'>
                    <div className='text-lg mb-2'>No {wizard.label.toLowerCase()} added yet</div>
                    <div className='text-sm'>Click "Add" button to create the first item</div>
                </div>
            ) : (
                data.map((item, index) => (
                    <ListItem
                        key={`${wizard.id}-${index}`}
                        item={item}
                        index={index}
                        wizard={wizard}
                        onUpdate={handleUpdate}
                        onRemove={handleRemove}
                        specName={specName}
                    />
                )))}
        </div>
    );
});

// Array item component using DynamicForm
const ArrayItem = React.memo<{
    item: any;
    index: number;
    wizard: WizardData;
    onItemChange: (index: number, newItemData: any) => void;
    onRemove: (index: number) => void;
    specName?: string;
    path?: string;
}>(({ item, index, wizard, onItemChange, onRemove, specName, path = '' }) => {
    const dynamicOptions = useYamlTemplateCtx();
    const initialData = item && typeof item === 'object' ? item : {};
    const itemRef = useRef(initialData);
    const onItemChangeRef = useRef(onItemChange);
    const lastEmittedDataRef = useRef<string>('');

    // Update refs when props change
    useEffect(() => {
        itemRef.current = initialData;
        onItemChangeRef.current = onItemChange;
    }, [initialData, onItemChange]);

    // Create form inputs for input type children
    const formInputs = useMemo(() => {
        return wizard.children
            ?.filter(child => child.type === 'input')
            .map(child => ({
                id: child.id,
                name: child.id,
                label: child.label,
                type: getFormInputType(child),
                placeholder: `Enter ${child.label}`,
                disabled: child.readOnly || false,
                helpText: child.helpText || '',
                options: child.inputType === 'select' ? getOptions(child.id, specName, dynamicOptions, wizard.id) : [],
                validation: child.validations || {}
            } as BaseField)) || [];
    }, [wizard.children, specName, dynamicOptions]);

    // Initialize form with current data or defaults
    const formData = useMemo(() => {
        const initialFormData: Record<string, any> = {};
        wizard.children?.forEach(child => {
            if (child.type === 'input') {
                initialFormData[child.id] = initialData[child.id] !== undefined
                    ? initialData[child.id]
                    : (child.defaultValue || '');
            }
        });
        return initialFormData;
    }, [initialData, wizard.children]);

    const form = useForm({
        mode: 'onChange',
        defaultValues: formData
    });

    // Watch for form changes and update parent with debounce
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        const subscription = form.watch((value) => {
            // Debounce updates to reduce re-renders
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                // Merge form data with existing item data (including nested objects/arrays)
                const updatedData = { ...itemRef.current };
                Object.keys(value).forEach(key => {
                    if (value[key] !== undefined) {
                        updatedData[key] = value[key];
                    }
                });

                // Check if data actually changed by comparing JSON
                const newDataJson = JSON.stringify(updatedData);
                if (newDataJson === lastEmittedDataRef.current) {
                    return;
                }

                lastEmittedDataRef.current = newDataJson;
                onItemChangeRef.current(index, updatedData);
            }, 300);
        });
        return () => {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, [form, index]);

    const handleNestedChange = useCallback((childId: string, childData: any) => {
        const currentFormValues = form.getValues();
        const updatedItem = { ...itemRef.current, ...currentFormValues, [childId]: childData };
        onItemChangeRef.current(index, updatedItem);
    }, [form, index]);

    const nestedChildren = wizard.children?.filter(child => child.type !== 'input') || [];

    return (
        <div className='border p-4 rounded bg-white'>
            <div className='flex justify-between items-center mb-2'>
                <span className='text-xs bg-green-100 text-green-800 px-2 py-1 rounded'>
                    {wizard.label} #{index + 1}
                </span>
                <button
                    className='nnp-btn bg-red-100 text-red-600 hover:text-red-800 flex items-center gap-1'
                    onClick={() => onRemove(index)}
                >
                    <DeleteIcon fontSize='small' /> Remove
                </button>
            </div>

            {/* Render input fields using DynamicForm */}
            {formInputs.length > 0 && (
                <div className='mb-4'>
                    <DynamicForm
                        inputs={formInputs}
                        formMethods={form}
                        defaultValues={formData}
                        layout='single'
                        hideSubmitButton={true}
                    />
                </div>
            )}

            {/* Render nested objects/arrays */}
            {nestedChildren.map(child => (
                <div key={`${child.id}-${index}`} className='bg-gray-50 p-3 rounded mb-2'>
                    <WizardElementsInner
                        data={initialData[child.id]}
                        wizard={child}
                        onDataChange={(childData) => handleNestedChange(child.id, childData)}
                        specName={specName}
                        path={`${path}/${wizard.id}[${index}]`}
                        parent={wizard.id}
                    />
                </div>
            ))}
        </div>
    );
});

const ArrayWizard = React.memo<{
    wizard: WizardData;
    data: any[];
    onDataChange?: (data: any[]) => void;
    specName?: string;
    path?: string;
}>(({ wizard, data = [], onDataChange, specName, path = '' }) => {
    const { updateTopics, updateExceptions, updateRepositories, updateModels, registerProvider, unregisterProvider } = useYamlTemplateCtx();
    const currentPath = `${path}/${wizard.id}`;
    const isProviderRef = useRef(false);
    const [optionsReady, setOptionsReady] = React.useState(false);

    // Register as provider on mount and determine if this component should provide options
    useLayoutEffect(() => {
        const shouldProvide = registerProvider(wizard.id, currentPath);
        isProviderRef.current = shouldProvide;

        return () => {
            unregisterProvider(wizard.id, currentPath);
        };
    }, [wizard.id, currentPath, registerProvider, unregisterProvider]);

    // Use layoutEffect to update options synchronously before child components render
    useLayoutEffect(() => {
        if(!isProviderRef.current) {
            LoggerService.info(`ArrayWizard - ${wizard.id} - skipping as nested component at ${currentPath}`);
            setOptionsReady(true);
            return;
        }

        if(wizard.id === 'topics'){
            const topicsOptions = data.length ? data.map( d => ({label: d.name || '', value: d.name || ''}) ) : [];
            LoggerService.info("ArrayWizard - topics - updating options", topicsOptions);
            updateTopics(topicsOptions);
        }
        if(wizard.id === 'exceptions'){
            const exceptionsOptions = data.length ? data.map( d => ({label: d.name || '', value: d.name || ''})) : [];
            LoggerService.info("ArrayWizard - exceptions - updating options", exceptionsOptions);
            updateExceptions(exceptionsOptions);
        }
        if(wizard.id === 'repositories'){
            const repositoriesOptions = data.length ? data.map( d => ({label: d.name || '', value: d.name || ''})) : [];
            LoggerService.info("ArrayWizard - repositories - updating options", repositoriesOptions);
            updateRepositories(repositoriesOptions);
        }
        if(wizard.id === 'models' ){
            const modelsOptions = data.length ? data.map( d => ({label: d.name || '', value: d.name || ''}) ) : [];
            LoggerService.info("ArrayWizard - models - updating options", modelsOptions);
            updateModels(modelsOptions);
        }

        setOptionsReady(true);
    }, [data, wizard.id, specName, updateTopics, updateExceptions, updateRepositories, updateModels]);

    const handleRemove = useCallback((index: number) => {
        if (onDataChange) {
            onDataChange(data.filter((_, i) => i !== index));
        }
    }, [onDataChange, data]);

    const handleItemChange = useCallback((index: number, newItemData: any) => {
        if (onDataChange) {
            const newData = [...data];
            newData[index] = newItemData;
            onDataChange(newData);
        }
    }, [onDataChange, data]);

    if (!wizard.children?.length) return null;

    // Wait for options to be ready before rendering children
    if (!optionsReady) {
        return <div className='text-gray-500 text-center py-4'>Loading...</div>;
    }

    return (
        <div className='space-y-4'>
            {data.length === 0 ? (
                <div className='text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg'>
                    <div className='text-lg mb-2'>No {wizard.label.toLowerCase()} added yet</div>
                    <div className='text-sm'>Click "Add" button to create the first item</div>
                </div>
            )
                : (
                    data.map((item, index) => (
                        <ArrayItem
                            key={`${wizard.id}-item-${index}`}
                            item={item}
                            index={index}
                            wizard={wizard}
                            onItemChange={handleItemChange}
                            onRemove={handleRemove}
                            specName={specName}
                            path={path}
                        />
                    )))}
        </div>
    );
});

// Input wizard component
const InputWizard = React.memo<{
    wizard: WizardData;
    data: string;
    onDataChange?: (data: string) => void;
    specName?: string;
    parent?: string;
}>(({ wizard, data, onDataChange, specName, parent }) => {
    const dynamicOptions = useYamlTemplateCtx();
    const onDataChangeRef = useRef(onDataChange);
    const lastEmittedDataRef = useRef<string>('');

    // Update ref when callback changes
    useEffect(() => {
        onDataChangeRef.current = onDataChange;
    }, [onDataChange]);

    const inputConfig = useMemo(() => [{
        id: 'value',
        name: 'value',
        label: wizard.label,
        type: wizard.inputType && wizard.inputType !== 'string' ? wizard.inputType : 'text',
        placeholder: `Enter ${wizard.label}`,
        disabled: wizard.readOnly || false,
        helpText: wizard.helpText || '',
        options: wizard.inputType === 'select' ? getOptions(wizard.id, specName, dynamicOptions, parent) : [],
        validation: wizard.validations || {}
    } as BaseField], [wizard, specName, dynamicOptions, parent]);

    const formValue = data || wizard.defaultValue || '';

    const form = useForm({
        mode: 'onChange',
        defaultValues: { value: formValue }
    });

    // Watch for form changes
    useEffect(() => {
        const subscription = form.watch((formData) => {
            const newValue = formData.value || '';

            // Check if data actually changed
            if (newValue === lastEmittedDataRef.current) {
                return;
            }

            lastEmittedDataRef.current = newValue;
            onDataChangeRef.current?.(newValue);
        });
        return () => subscription.unsubscribe();
    }, [form]);

    return (
        <div className='p-4'>
            <DynamicForm
                inputs={inputConfig}
                formMethods={form}
                defaultValues={{ value: formValue }}
                layout='single'
                hideSubmitButton={true}
            />
        </div>
    );
});

const WizardHeader = React.memo<{
    wizard: WizardData;
    onAdd?: () => void;
}>(({ wizard, onAdd }) => (
    <div className='flex items-center justify-between px-4 bg-[#888888] text-[#ffffcc] h-[50px]'>
        <div className='text-sm font-semibold'>
            {wizard.label}
            {wizard.mandatory && (
                <Tooltip title={`You have to add at least one ${wizard.label}`}>
                    <ErrorOutlineIcon color='error' className='ml-1 cursor-pointer' fontSize='small' />
                </Tooltip>
            )}
        </div>
        {(wizard.type === 'list' || wizard.type === 'array') && (
            <button
                className='nnp-btn bg-[#028f00] text-white'
                onClick={onAdd}
                type="button"
            >
                <AddIcon /> Add
            </button>
        )}
    </div>
));

// Main component - simplified data handling
const WizardElementsInner = React.memo<WizardElementsProps>(({ data, wizard, onDataChange, specName, path = '', parent }) => {
    // Simple data initialization based on wizard type
    const ctx = useYamlTemplateCtx();
    const scopedData = useMemo(() => {
        // For arrays and lists, always return array (empty or with data)
        if (wizard.type === 'list' || wizard.type === 'array') { // Special case for propertyfiles list if empty pass application.properties as default
            if (wizard.type === 'list' && (wizard.id === 'propertyfiles' && (!data || (Array.isArray(data) && data.length === 0)))) {
                return ['application.properties'];
            }
            else if (Array.isArray(data)) {
                return data;
            } else {
                return [];
            }
        }

        // For objects, check if it has meaningful content
        if (wizard.type === 'object') {
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                return data;
            } else {
                return {};
            }
        }

        // For inputs, use provided data or default
        if (wizard.type === 'input') {
            return data !== undefined && data !== null ? data : (wizard.defaultValue || '');
        }

        return data || null;
    }, [data, wizard.type, wizard.defaultValue]);

    const renderContent = () => {
        switch (wizard.type) {
            case 'object':
                return (
                    <ObjectWizard
                        wizard={wizard}
                        data={scopedData as Record<string, any>}
                        onDataChange={onDataChange}
                        specName={specName}
                        path={path}
                    />
                );
            case 'list':
                return (
                    <ListWizard
                        wizard={wizard}
                        data={scopedData as string[]}
                        onDataChange={onDataChange}
                        specName={specName}
                    />
                );
            case 'array':
                return (
                    <ArrayWizard
                        wizard={wizard}
                        data={scopedData as any[]}
                        onDataChange={onDataChange}
                        specName={specName}
                        path={path}
                    />
                );
            case 'input':
                return (
                    <InputWizard
                        wizard={wizard}
                        data={scopedData as string}
                        onDataChange={onDataChange}
                        specName={specName}
                        parent={parent}
                    />
                );
            default:
                return null;
        }
    };

    const handleAdd = () => {
        if (!onDataChange) return;

        const currentData = Array.isArray(scopedData) ? scopedData : [];

        if (wizard.type === 'list') {
            onDataChange([...currentData, wizard.defaultValue || '']);
        } else if (wizard.type === 'array' && wizard.children) {
            onDataChange([...currentData, initializeItem(wizard.children, ctx, wizard.id)]);
        }
    };

    if (!wizard) return null;

    return (
        <div className='flex flex-col h-full'>
            <WizardHeader wizard={wizard} onAdd={handleAdd} />
            <div className='flex-1 min-h-0 overflow-y-auto p-4 bg-gray-50'>
                {renderContent()}
            </div>
        </div>
    );
});

// Set display names for debugging
ObjectWizard.displayName = 'ObjectWizard';
ListItem.displayName = 'ListItem';
ListWizard.displayName = 'ListWizard';
ArrayItem.displayName = 'ArrayItem';
ArrayWizard.displayName = 'ArrayWizard';
InputWizard.displayName = 'InputWizard';
WizardHeader.displayName = 'WizardHeader';
WizardElementsInner.displayName = 'WizardElementsInner';


const WizardElements: React.FC<WizardElementsProps> = (props) => {
    return <WizardElementsInner {...props} />;
};

WizardElements.displayName = 'WizardElements';

export default WizardElements;