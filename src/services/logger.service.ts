const PRODUCTION = import.meta.env.PRODUCTION as boolean;

export const LoggerService = {
    info: (message: string, ...optionalParams: any[]) => {
        if (!PRODUCTION) {
            console.log(`INFO: ${message}`, ...optionalParams);
        }
    },
    warn: (message: string, ...optionalParams: any[]) => {
        if (!PRODUCTION) {
            console.warn(`WARN: ${message}`, ...optionalParams);
        }
    },
    error: (message: string, ...optionalParams: any[]) => {
        if (!PRODUCTION) {
            console.error(`ERROR: ${message}`, ...optionalParams);
        }
    },
    debug: (message: string, ...optionalParams: any[]) => {
        if (!PRODUCTION) {
            console.debug(`DEBUG: ${message}`, ...optionalParams);
        }
    }
};