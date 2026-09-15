import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';
import { ToastMessage, ToasterContextType, toasterService } from '@/services/toaster.service';

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

interface ToasterProviderProps {
  children: ReactNode;
}

export const ToasterProvider: React.FC<ToasterProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const generateId = () => `toast-${Date.now()}-${Math.random()}`;

  const showToast = (message: string, type: AlertColor, duration: number = 6000) => {
    const id = generateId();
    const newToast: ToastMessage = { id, message, type, duration };
    setToasts(prev => [...prev, newToast]);
  };

  const showSuccess = (message: string, duration?: number) => {
    showToast(message, 'success', duration);
  };

  const showError = (message: string, duration?: number) => {
    showToast(message, 'error', duration);
  };

  const showWarning = (message: string, duration?: number) => {
    showToast(message, 'warning', duration);
  };

  const showInfo = (message: string, duration?: number) => {
    showToast(message, 'info', duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const contextValue: ToasterContextType = {
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };

  React.useEffect(() => {
    toasterService.setContext(contextValue);
  }, []);

  return (
    <ToasterContext.Provider value={contextValue}>
      {children}
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open={true}
          autoHideDuration={toast.duration}
          onClose={() => removeToast(toast.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={() => removeToast(toast.id)}
            severity={toast.type}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToasterContext.Provider>
  );
};

export const useToaster = (): ToasterContextType => {
  const context = useContext(ToasterContext);
  if (context === undefined) {
    throw new Error('useToaster must be used within a ToasterProvider');
  }
  return context;
};