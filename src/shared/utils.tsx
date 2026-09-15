import Cookies from 'js-cookie';
import { showConfirmDialog } from '../widgets/confirmDialog';

export const formatSelectOptions = (domainconfig: any, input: any) => {
  if (input.type === 'select') {
    const rawOptions = input.labelKey ? domainconfig[input.labelKey] : domainconfig;

    const options = Object.entries(rawOptions).map(([key, value]) => ({
      label: (value as { label: string })?.label,
      value: input.valueKey ? (value as any)[input.valueKey] : key
    }));

    return options; // 🟢 inject options here
  }
  return input;
}

export const alertAction = (action: string, msg: string) => async () => {
  // setAction('REFRESH');
  switch (action) {
    case 'error':
      showConfirmDialog({
        title: 'Error!',
        message: msg,
        confirmText: 'OK',
        // cancelText: 'Cancel',
        type: 'error',
        onCancel: () => {
        },
      });
      break;

    case 'success':
      showConfirmDialog({
        title: 'Success',
        message: msg,
        confirmText: 'OK',
        // cancelText: 'Cancel',
        type: 'success',
        onCancel: () => {
        },
      });
      break;
  }
}
export const getEnvCode = () => {
  const envCookie = Cookies.get('X-Env');
  const code = envCookie ? JSON.parse(envCookie) : { envCode: 'REL-V2023.01' };
  console.log('env:', code)
  return code;
}
export const getXUser = () => {
  const envCookie = Cookies.get('X-User-Name');
  if (envCookie) return envCookie;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'nnpsuper' : 'pgadmin';
}
export const getXuserType = () => {
  const envCookie = Cookies.get('X-User-Type');
  if (envCookie) return envCookie;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? 'admin_role' : 'pgadmin';
}
export const convertDateNative = (isoString: string, showTime: boolean = true) => {
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  };

  if (showTime) {
    options.hour = "numeric";
    options.minute = "2-digit";
    options.hour12 = true;
  }

  return date.toLocaleString("en-IN", options);
};

export const getFormattedDateTime = (isoString = new Date().toISOString()) => {  // DD-MM-YYYY HH:MM:SS
  const now = new Date(isoString);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const day = String(now.getDate()).padStart(2, '0');

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}