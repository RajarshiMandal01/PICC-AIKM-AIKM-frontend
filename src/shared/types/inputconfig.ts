export type BaseField = {
  type: 'text' | 'email' | 'number' | 'password' | 'textarea' | 'select'| 'datetime' | 'checkbox' | 'multipleCheckbox' | 'manualValidation' | 'json';
  name: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  validation?: Record<string, any>;
  customValidations?: Record<string,(value: any) => boolean | string | Promise<boolean | string>>;
  disabled?: boolean;
  manualCheckValidatorFn?: (value: any) => boolean | string | Promise<boolean | string>; // For validations that need to be triggered manually, e.g., on button click
  options?: string[] | { label: string; value: any, disabled?: boolean }[];
  url?: string;
  labelKey?: string;
  valueKey?: string;
  displayFormat?:string;
  storeFormat?:string
  multipleCheckboxCallbackFn?: (selectedOption: string, input: BaseField) => void;
};

export type DynamicGroupField = {
  type: 'dynamicGroup';
  name: string;
  label: string;
  multiple?: boolean;
  options: {
    label: string;
    value: string;
    childForm: BaseField[];
  }[];
};

export type InputConfig = (BaseField | DynamicGroupField)[];