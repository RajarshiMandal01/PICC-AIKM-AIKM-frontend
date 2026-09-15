import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { LoggerService } from '@/services/logger.service';

// YAML Template context - handles dynamic options and YAML data for specific modules (RestPublisher, AMQPPublisher, etc.)
export interface YamlTemplateContextType {
    repositories: { label: string; value: string }[];
    exceptions: { label: string; value: string }[];
    models: { label: string; value: string }[];
    topics: { label: string; value: string }[];
    brokerType: string;
    specName: string;
    updateRepositories: (options: { label: string; value: string }[]) => void;
    updateExceptions: (options: { label: string; value: string }[]) => void;
    updateModels: (options: { label: string; value: string }[]) => void;
    updateTopics: (options: { label: string; value: string }[]) => void;
    updateBrokerType: (value: string) => void;
    registerProvider: (id: string, path: string) => boolean;
    unregisterProvider: (id: string, path: string) => void;
}

const YamlTemplateContext = createContext<YamlTemplateContextType | null>(null);

export const useYamlTemplateCtx = () => {
    const context = useContext(YamlTemplateContext);
    if (!context) {
        throw new Error('useYamlTemplateCtx must be used within YamlTemplateProvider');
    }
    return context;
};


// Provider component
interface YamlTemplateProviderProps {
    children: React.ReactNode;
    specName: string;
}

export const YamlTemplateProvider: React.FC<YamlTemplateProviderProps> = ({ 
    children, 
    specName
}) => {
    const [repositories, setRepositories] = useState<{ label: string; value: string }[]>([]);
    const [exceptions, setExceptions] = useState<{ label: string; value: string }[]>([]);
    const [models, setModels] = useState<{ label: string; value: string }[]>([]);
    const [topics, setTopics] = useState<{ label: string; value: string }[]>([]);
    const [brokerType, setBrokerType] = useState<string>('');

    // Registry to track which component provides options for each ID (to handle nested same IDs)
    // Key: wizard ID (e.g., 'models'), Value: Set of component paths (to identify nesting level)
    const providersRef = useRef<Map<string, Set<string>>>(new Map());

    const registerProvider = useCallback((id: string, path: string): boolean => {
        if (!providersRef.current.has(id)) {
            providersRef.current.set(id, new Set());
        }
        const providers = providersRef.current.get(id)!;

        // If this is the first provider or has shorter path (top-level), it becomes the provider
        if (providers.size === 0) {
            providers.add(path);
            LoggerService.info(`Registered provider for ${id} at path: ${path}`);
            return true;
        }

        // Check if this path is shorter (higher level) than existing ones
        const existingPaths = Array.from(providers);
        const isTopLevel = existingPaths.every(existingPath => path.length < existingPath.length);

        if (isTopLevel) {
            // This is a higher-level component, it should provide
            providers.clear();
            providers.add(path);
            LoggerService.info(`Replaced provider for ${id} with higher-level path: ${path}`);
            return true;
        } else {
            // This is a nested component, don't provide
            providers.add(path);
            LoggerService.info(`Nested provider for ${id} at path: ${path} - not providing options`);
            return false;
        }
    }, []);

    const unregisterProvider = useCallback((id: string, path: string) => {
        const providers = providersRef.current.get(id);
        if (providers) {
            providers.delete(path);
            if (providers.size === 0) {
                providersRef.current.delete(id);
            }
        }
    }, []);

    const contextValue: YamlTemplateContextType = {
        repositories,
        exceptions,
        models,
        topics,
        brokerType,
        specName,
        updateRepositories: setRepositories,
        updateExceptions: setExceptions,
        updateModels: setModels,
        updateTopics: setTopics,
        updateBrokerType: setBrokerType,
        registerProvider,
        unregisterProvider,
    };

    return (
        <YamlTemplateContext.Provider value={contextValue}>
            {children}
        </YamlTemplateContext.Provider>
    );
};

