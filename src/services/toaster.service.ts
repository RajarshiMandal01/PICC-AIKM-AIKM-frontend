import { AlertColor } from '@mui/material';
import { LoggerService } from './logger.service';

export interface ToastMessage {
  id: string;
  message: string;
  type: AlertColor;
  duration?: number;
}

export interface ToasterContextType {
  showToast: (message: string, type: AlertColor, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

export class ToasterService {
  private static instance: ToasterService;
  private toasterContext: ToasterContextType | null = null;

  static getInstance(): ToasterService {
    if (!ToasterService.instance) {
      ToasterService.instance = new ToasterService();
    }
    return ToasterService.instance;
  }

  setContext(context: ToasterContextType) {
    this.toasterContext = context;
  }

  showToast(message: string, type: AlertColor, duration?: number) {
    if (this.toasterContext) {
      this.toasterContext.showToast(message, type, duration);
    } else {
      LoggerService.warn('Toaster context not available');
    }
  }

  showSuccess(message: string, duration?: number) {
    this.showToast(message, 'success', duration);
  }

  showError(message: string, duration?: number) {
    this.showToast(message, 'error', duration);
  }

  showWarning(message: string, duration?: number) {
    this.showToast(message, 'warning', duration);
  }

  showInfo(message: string, duration?: number) {
    this.showToast(message, 'info', duration);
  }
}

export const toasterService = ToasterService.getInstance();