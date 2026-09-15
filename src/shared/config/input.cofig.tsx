import type { InputConfig } from "../types/inputconfig";

export const AccountDetailsForm: InputConfig = [
  {
    type: 'text',
    name: 'environmentId',
    label: 'Environment ID',
    placeholder: 'Enter Environment ID',
    validation: { required: 'Environment ID is required' },
  },
  {
    type: 'text',
    name: 'environmentCode',
    label: 'Environment Code',
    placeholder: 'Enter Environment Code',
    validation: { required: 'Environment Code is required' },
  },
  {
    type: 'text',
    name: 'accountName',
    label: 'Account Name',
    placeholder: 'Enter Account Name',
    validation: { required: 'Account Name is required' },
  },
  {
    type: 'text',
    name: 'repoName',
    label: 'Repo Name',
    placeholder: 'Enter Repository Name',
    validation: { required: 'Repo Name is required' },
  },
  {
    type: 'text',
    name: 'primaryUsername',
    label: 'Primary Username',
    placeholder: 'Enter Primary Username',
    validation: { required: 'Primary Username is required' },
  },
  {
    type: 'email',
    name: 'email',
    label: 'Email',
    placeholder: 'Enter Email Address',
    validation: { required: 'Email is required' },
  },
  {
    type: 'text',
    name: 'country',
    label: 'Country',
    placeholder: 'Enter Country',
    validation: { required: 'Country is required' },
  },
  {
    type: 'text',
    name: 'phone',
    label: 'Phone',
    placeholder: 'Enter Phone Number',
    validation: { required: 'Phone number is required' },
  },
  {
    type: 'text',
    name: 'organization',
    label: 'Organization',
    placeholder: 'Enter Organization',
    validation: { required: 'Organization is required' },
  },
  {
    type: 'select',
    name: 'category',
    label: 'Category',
    options: [
      { label: 'Internal', value: 'internal' },
      { label: 'External', value: 'external' },
    ],
    validation: { required: 'Category is required' },
  },
  {
    type: 'textarea',
    name: 'address',
    label: 'Address',
    placeholder: 'Enter Address',
  },
  {
    type: 'textarea',
    name: 'purpose',
    label: 'Purpose',
    placeholder: 'Enter Purpose',
  },
];
