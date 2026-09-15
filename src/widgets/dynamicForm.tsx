// src/components/DynamicForm.tsx
import React, { useEffect, useState } from 'react';
import { useForm, Controller, type UseFormReturn, type Control } from 'react-hook-form';
import clsx from 'clsx';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DesktopDateTimePicker } from '@mui/x-date-pickers/DesktopDateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import type { BaseField, DynamicGroupField, InputConfig } from '../shared/types/inputconfig';
import { Checkbox, IconButton } from '@mui/material';
import LaunchIcon from '@mui/icons-material/Launch';
import Editor from './editor';

type Props = {
    inputs: InputConfig;
    layout?: 'single' | 'double';
    onSubmit?: (formattedData: any) => void;
    defaultValues?: Record<string, any>;
    formMethods?: UseFormReturn<any>;
    control?: Control<any>;
    editable?: boolean; // NEW prop
    hideSubmitButton?: boolean; // NEW prop
    submitButtonText?: string; // NEW prop
};

const DynamicForm: React.FC<Props> = ({
    inputs,
    layout = 'single',
    onSubmit,
    defaultValues,
    formMethods,
    control: externalControl,
    editable = true, // default = editable
    hideSubmitButton = false, // default = show submit button
    submitButtonText = 'Submit',
}) => {
    const internalForm = useForm({
        mode: 'onChange',
        defaultValues,
    });

    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
        reset,
        control: internalControl,
        watch,
        trigger,
        clearErrors,
        setError,
    } = formMethods || internalForm;

    const control = externalControl || internalControl;
    const values = watch(); // to display in read-only mode

    const [staticFields, setStaticFields] = useState<BaseField[]>([]);
    const [dynamicGroups, setDynamicGroups] = useState<DynamicGroupField[]>([]);
    const [groupSelections, setGroupSelections] = useState<Record<string, string>>({});
    const [selectedGroups, setSelectedGroups] = useState<
        { groupName: string; value: string; label: string; fields: BaseField[]; collapsed: boolean }[]
    >([]);
    const [regexValidMap, setRegexValidMap] = useState<Record<string, boolean>>({});
        const handleRegexChange = (
        fieldName: string,
        value: string,
        pattern?: RegExp
        ): boolean => {
        const valid = pattern ? pattern.test(value) : true;
        setRegexValidMap((prev) => ({ ...prev, [fieldName]: valid }));
        return valid;
        };


    // Separate static and dynamic fields
    useEffect(() => {
        const dynamics = inputs.filter(i => i.type === 'dynamicGroup') as DynamicGroupField[];
        const statics = inputs.filter(i => i.type !== 'dynamicGroup') as BaseField[];
        setStaticFields(statics);
        setDynamicGroups(dynamics);
    }, [inputs]);

    // Track previous defaultValues to avoid unnecessary resets
    const prevDefaultValuesRef = React.useRef<string>('');

    useEffect(() => {
        if (!defaultValues) return;

        const currentDefaultValuesJson = JSON.stringify(defaultValues);

        // Only reset if defaultValues actually changed (not just a re-render with same values)
        if (currentDefaultValuesJson !== prevDefaultValuesRef.current) {
            reset(defaultValues, { keepErrors: true, keepDirty: true, keepTouched: true });
            prevDefaultValuesRef.current = currentDefaultValuesJson;
        }
    }, [defaultValues, reset]);

    // Load default values and dynamic group states
    useEffect(() => {
        if (defaultValues && dynamicGroups.length > 0) {
            reset(defaultValues, { keepErrors: true, keepDirty: true, keepTouched: true });
            const dynamicStates = dynamicGroups.flatMap(group => {
                const values = defaultValues[group.name];
                if (!Array.isArray(values)) return [];
                return values
                    .map((entry: any) => {
                        const option = group.options.find(opt => opt.value === entry.name);
                        return option
                            ? { groupName: group.name, value: option.value, label: option.label, fields: option.childForm, collapsed: false }
                            : null;
                    })
                    .filter(Boolean);
            });
            setSelectedGroups(dynamicStates as any);
        }
    }, [defaultValues, dynamicGroups, reset]);

    const getLayoutClass = () =>
        layout === 'double' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-4';

    const handleAddGroup = (groupName: string) => {
        const group = dynamicGroups.find(g => g.name === groupName);
        const selected = groupSelections[groupName];
        if (!group || !selected) return;
        const option = group.options.find(o => o.value === selected);
        if (!option) return;
        setSelectedGroups(prev => [...prev, { groupName, value: option.value, label: option.label, fields: option.childForm, collapsed: false }]);
        setGroupSelections(prev => ({ ...prev, [groupName]: '' }));
    };

    const handleRemoveGroup = (groupName: string, value: string) => {
        setSelectedGroups(prev => prev.filter(g => !(g.groupName === groupName && g.value === value)));
    };

    const toggleCollapse = (groupName: string, value: string) => {
        setSelectedGroups(prev =>
            prev.map(g => (g.groupName === groupName && g.value === value ? { ...g, collapsed: !g.collapsed } : g))
        );
    };

    const formatDateValue = (val: any, storeFormat?: string) => {
        if (!val) return '';
        if (storeFormat === 'unix') return dayjs(val).valueOf();
        if (storeFormat === 'iso') return dayjs(val).toISOString();
        return dayjs(val).format(storeFormat || 'YYYY-MM-DDTHH:mm:ss');
    };


    const renderField = (field: BaseField, fieldName?: string) => {
        const name = fieldName || field.name;
        const errorObj = errors as any;
        const currentValue = values?.[name];

        // If not editable → just show plain value
        if (!editable) {
            let displayVal = currentValue ?? '';
            if (field.type === 'datetime' && displayVal) {
                displayVal = dayjs(displayVal).format(field.displayFormat || 'YYYY-MM-DD HH:mm');
            }
            if (field.type === 'select') {
                const opt = (field.options || []).find(
                    (o: any) => (typeof o === 'string' ? o === displayVal : o.value === displayVal)
                );
                displayVal = typeof opt === 'string' ? opt : opt?.label || displayVal;
            }
            return <span className="text-gray-800">{displayVal || '-'}</span>;
        }

        // Editable inputs
        if (field.type === 'textarea') {
            return (
                <textarea
                    {...register(name, {
                        ...field.validation,
                        validate: field.customValidations,
                    })}
                    placeholder={field.placeholder}
                    className={clsx('border p-2 rounded w-full', errorObj[name] && 'border-red-500')}
                />
            );
        }
        if (field.type === 'json') {
            return (
                <Controller
                    name={name}
                    control={control}
                    rules={{
                        ...field.validation,
                        validate: field.customValidations,
                    }}
                    render={({ field: rhfField }) => (
                        <div className='border-2 border-gray-100'>
                            <Editor
                                value={rhfField.value || ''}
                                mode="json"
                                onChange={(value) => rhfField.onChange(value)}
                                readonly={!editable || field.disabled}
                            />
                        </div>
                    )}
                />
            );
        }

        if (field.type === 'select') {
            return (
                <select
                    {...register(name, {
                        ...field.validation,
                        validate: field.customValidations,
                    })}
                    className={clsx('border p-2 rounded w-full', errorObj[name] && 'border-red-500')}
                    disabled={!editable || field.disabled}
                >
                    <option value="">Select</option>
                    {(field.options || []).map((opt: any, idx: number) =>
                        typeof opt === 'string' ? (
                            <option key={idx} value={opt}>
                                {opt}
                            </option>
                        ) : (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        )
                    )}
                </select>
            );
        }

        if (field.type === 'checkbox') {
            return (
                <Checkbox
                    {...register(name, {
                        ...field.validation,
                        validate: field.customValidations,
                    })}
                    disabled={!editable || field.disabled}
                    checked={!!currentValue}
                    className={clsx('w-[42px]',errorObj[name] && 'border-red-500')}
                    size='medium'
                />
            );
        }

        if (field.type === 'multipleCheckbox') {
            return (
                <Controller
                    name={name}
                    control={control}
                    rules={{
                        ...field.validation,
                        validate: field.customValidations,
                    }}
                    render={({ field: rhfField }) => {
                        const selectedValues = rhfField.value || {};

                        return (
                            <div className={clsx('', errorObj[name] && 'border border-red-500 p-2 rounded')}>
                                {(field.options || []).map((opt: any, idx: number) => {
                                    const optValue = typeof opt === 'string' ? opt : opt.value;
                                    const optLabel = typeof opt === 'string' ? opt : opt.label;
                                    const propertyName = optValue;
                                    const isChecked = !!selectedValues[propertyName];

                                    return (
                                        <div className='flex items-center space-x-2' key={propertyName}>
                                        <label key={idx} className="flex items-center space-x-2 cursor-pointer font-medium">
                                            <Checkbox
                                                checked={isChecked}
                                                disabled={!editable || field.disabled || opt.disabled}
                                                onChange={(e) => {
                                                    if (!editable || field.disabled || opt.disabled) return;

                                                    const newValues = {
                                                        ...selectedValues,
                                                        [propertyName]: e.target.checked
                                                    };

                                                    // Remove false values to keep object clean
                                                    if (!e.target.checked) {
                                                        delete newValues[propertyName];
                                                    }

                                                    rhfField.onChange(newValues);
                                                }}
                                                size="medium"
                                            />
                                            <span className={`text-sm ${(!editable || field.disabled || opt.disabled) ? 'text-gray-500' : ''}`}>{optLabel}</span>
                                        </label>
                                        {field.multipleCheckboxCallbackFn && isChecked && (
                                                <LaunchIcon className="text-blue-500 cursor-pointer" fontSize="small" onClick={() => {
                                                    field.multipleCheckboxCallbackFn?.(propertyName, field); 
                                                }} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }}
                />
            );
        }

        if (field.type === 'datetime') {
            return (
                <Controller
                    name={name}
                    control={control}
                    rules={field.validation}
                    render={({ field: rhfField }) => (
                        <DesktopDateTimePicker
                            disabled={!editable || field.disabled}
                            value={rhfField.value ? dayjs(rhfField.value) : null}
                            onChange={(newValue: any) => rhfField.onChange(formatDateValue(newValue, field.storeFormat))}
                            format={field.displayFormat || 'YYYY-MM-DD HH:mm'}
                            slotProps={{
                                textField: { fullWidth: true, error: !!errorObj[name] },
                            }}
                        />
                    )}
                />
            );
        }
        if (field.type === 'manualValidation') {
        const pattern = field.validation?.pattern as any;
        const isRegexValid = regexValidMap[name] ?? false;

        return (
            <div className="flex">
            <input
                type="text"
                {...register(name, {
                ...field.validation,
                validate: field.customValidations,
                })}
                onChange={(e) => {
                const value = e.target.value;
                const isValid = handleRegexChange(name, value, pattern?.value);

                if (!isValid) {
                    setError(name, {
                    type: 'manual',
                    message:
                        'App name must start with a lowercase letter and can contain lowercase letters, numbers, and single hyphens only.',
                    });
                } else {
                    clearErrors(name);
                    setError(name, {
                    type: 'manual',
                    message: 'App name needs to be validated first',
                    });
                }
                }}
                placeholder={field.placeholder}
                disabled={!editable || field.disabled}
                className={clsx(
                            'p-2 flex-1  rounded-l',
                editable ? 'border' : 'bg-transparent border-0',
                errorObj[name] && 'border-red-500'
                )}
            />
            {editable && (
                <button
                type="button"
                onClick={async (e) => {
                    const input = (e.target as HTMLElement)
                    .previousElementSibling as HTMLInputElement;
                    const value = input.value;

                    if (!isRegexValid) {
                    setError(name, {
                        type: 'manual',
                        message:
                        'Please enter a valid app name before validating.',
                    });
                    return;
                    }

                    const result = await field.manualCheckValidatorFn?.(value);
                    if (result === true) {
                    clearErrors(name);
                    await trigger();
                    } else {
                    setError(name, {
                        type: 'manual',
                        message:
                        typeof result === 'string'
                            ? result
                            : 'Validation failed',
                    });
                    }
                }}
                className={"px-4 py-2 rounded-r " + (isRegexValid && !field.disabled ? 'nnp-btn-primary' : 'nnp-btn-disabled !cursor-not-allowed')}
                disabled={field.disabled || !isRegexValid}
                >
                Validate
                </button>
            )}
            </div>
        );
        }

        return (
            <input
                type={field.type}
                {...register(name, {
                    ...field.validation,
                    validate: field.customValidations,
                    onChange: (e) => {
                        const value = e.target.value;
                        const pattern = field.validation?.pattern as any;
                        const isValid = handleRegexChange(name, value, pattern?.value as any);

                        if (!isValid) {
                            setError(name, {
                            type: 'manual',
                            message: pattern?.message || 'Invalid format',
                            });
                        } else {
                            clearErrors(name);
                        }
                    }
                })}

                placeholder={field.placeholder}
                disabled={!editable || field.disabled}
                className={clsx(
                    'p-2 w-full',
                    editable ? 'border rounded' : 'bg-transparent border-0',
                    errorObj[name] && 'border-red-500'
                )}
            />
        );
    };

    const handleFormSubmit = (data: Record<string, any>) => {
        if (!onSubmit) return;
        let result: Record<string, any> = {};

        staticFields.forEach(field => {
            result[field.name] = data[field.name];
        });

        dynamicGroups.forEach(group => {
            const entries = selectedGroups.filter(g => g.groupName === group.name);
            if (entries.length) {
                result[group.name] = entries.map(entry => {
                    const args: Record<string, any>[] = [];
                    entry.fields.forEach(field => {
                        const val = data?.[group.name]?.[entry.value]?.[field.name];
                        if (val !== undefined && val !== '') {
                            args.push({ [field.name]: val });
                        }
                    });
                    return { name: entry.value, args };
                });
            }
        });

        result = { ...data, ...result };
        onSubmit(result);
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <form onSubmit={handleSubmit(handleFormSubmit)} className="w-full space-y-4">
                {/* Static Fields */}
                <div className={getLayoutClass()}>
                    {staticFields.map(input => (
                        <div key={input.name} className="flex flex-col gap-1">
                            <label className="font-medium text-[var(--text-color-tertiary)] flex items-center">
                                {
                                    input.helpText ? (
                                        <IconButton className='!py-0 !pl-0' aria-label="help" size="small" color='primary' title={input.helpText} >
                                            <HelpOutlineIcon fontSize="small"/>
                                        </IconButton>
                                    ) : null
                                }
                                {input.label}
                                {input.validation?.required && <span className="text-red-500 ml-1">*</span>}
                                </label>
                            {renderField(input)}
                            {editable && errors[input.name] && (
                                <span className="text-red-500 text-sm">{(errors as any)[input.name]?.message}</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Dynamic Groups */}
                {dynamicGroups.map(group => {
                    const availableOptions = group.options.filter(
                        opt => !selectedGroups.find(sel => sel.groupName === group.name && sel.value === opt.value)
                    );

                    return (
                        <div key={group.name} className="mt-6">
                            <label className="block font-medium text-[var(--text-color-tertiary)] mb-1">{group.label}</label>

                            {editable && (
                                <div className="flex items-center gap-4">
                                    <select
                                        value={groupSelections[group.name] || ''}
                                        onChange={e => setGroupSelections(prev => ({ ...prev, [group.name]: e.target.value }))}
                                        className="border p-2 rounded w-64"
                                    >
                                        <option value="">Select Option</option>
                                        {availableOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => handleAddGroup(group.name)}
                                        disabled={!groupSelections[group.name]}
                                        className={clsx(
                                            'px-4 py-2 rounded text-white',
                                            groupSelections[group.name]
                                                ? 'bg-blue-600 hover:bg-blue-700'
                                                : 'bg-gray-400 cursor-not-allowed'
                                        )}
                                    >
                                        +
                                    </button>
                                </div>
                            )}

                            {selectedGroups
                                .filter(g => g.groupName === group.name)
                                .map(({ value, label, fields, collapsed }) => (
                                    <div
                                        key={`${group.name}-${value}`}
                                        className={clsx(
                                            'mt-4 relative',
                                            editable ? 'border p-4 rounded shadow' : 'p-2'
                                        )}
                                    >
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-semibold">{label}</h4>
                                            {editable && (
                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCollapse(group.name, value)}
                                                        className="text-blue-500 text-sm hover:underline"
                                                    >
                                                        {collapsed ? 'Expand' : 'Collapse'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveGroup(group.name, value)}
                                                        className="text-red-500 text-sm hover:underline"
                                                    >
                                                        ✕ Remove
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {!collapsed &&
                                            fields.map(field => {
                                                const fieldName = `${group.name}.${value}.${field.name}`;
                                                return (
                                                    <div key={fieldName} className="mb-4">
                                                        <label className="block mb-1">{field.label}</label>
                                                        {renderField(field, fieldName)}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                ))}
                        </div>
                    );
                })}

                {/* Submit button only if editable */}
                {editable && !hideSubmitButton && (
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={!isValid}
                            className={clsx(
                                'nnp-btn',
                                isValid ? 'nnp-btn-primary' : 'nnp-btn-disabled !cursor-not-allowed'
                            )}
                        >
                            {submitButtonText}
                        </button>
                    </div>
                )}
            </form>
        </LocalizationProvider>
    );
};

export default DynamicForm;
