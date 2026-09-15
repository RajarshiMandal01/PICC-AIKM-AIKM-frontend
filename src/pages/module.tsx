import React, { useState } from 'react';
import { toasterService } from '@/services/toaster.service';
import { LoggerService } from '@/services/logger.service';
import { TransactionService } from '@/services/transation.service';

function ModuleComponent() {
  const [formData, setFormData] = useState({
    projectTitle: '',
    repoUrl: '',
    repoToken: '',
    projectName: '',
    requirementDocument: null as File | null,
    generationOptions: {
      wbs: false,
      designDoc: false,
      backendCode: false,
      frontendCode: false,
      database: false,
      testScripts: false,
    },
    techStack: {
      language: '',
      framework: '',
      uiTech: '',
      database: '',
      testScript: ''
    }
  });

  const [executionStatus, setExecutionStatus] = useState({
    isGenerating: false,
    progress: 0,
    currentTask: 'Idle'
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTechStackChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      techStack: { ...prev.techStack, [name]: value }
    }));
  };

  const handleCheckboxChange = (optionKey: keyof typeof formData.generationOptions) => {
    setFormData(prev => ({
      ...prev,
      generationOptions: {
        ...prev.generationOptions,
        [optionKey]: !prev.generationOptions[optionKey]
      }
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFormData(prev => ({ ...prev, requirementDocument: e.target.files![0] }));
    }
  };

  const handleStartGeneration = () => {
    if (!formData.projectTitle || !formData.repoUrl || !formData.repoToken || !formData.projectName) {
      toasterService.showError("Please fill out all required fields.");
      return;
    }

    LoggerService.info("Starting generation with data:", formData);
    setExecutionStatus({ isGenerating: true, progress: 10, currentTask: 'Sending request to backend...' });
    
    // --- REAL API CALL ---
    TransactionService.generateRequest(formData)
      .then(response => {
        LoggerService.info("Generation response:", response);
        toasterService.showSuccess("Generation initiated successfully!");
        setExecutionStatus({ isGenerating: false, progress: 100, currentTask: 'Generation Request Sent Successfully' });
        // Optional: clear the form here if you want
      })
      .catch(error => {
        LoggerService.error("Generation failed:", error);
        toasterService.showError("Failed to start generation. Please try again.");
        setExecutionStatus({ isGenerating: false, progress: 0, currentTask: 'Failed' });
      });
  };

  return (
    <div className="flex flex-col gap-5 p-4 w-full h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        <section className="border border-gray-300 bg-white p-5 rounded shadow-sm">
          <h3 className="text-gray-700 font-bold mb-4">New Execution</h3>
          <div className="flex flex-col gap-4">
            <label className="text-gray-600 text-sm font-medium">
              Project Title<span className="text-red-500">*</span>
              <input type="text" name="projectTitle" value={formData.projectTitle} onChange={handleInputChange} className="w-full border border-gray-300 p-2 mt-1 rounded focus:outline-none focus:border-blue-500 font-normal" />
            </label>
            <label className="text-gray-600 text-sm font-medium">
              NNP Repository URL<span className="text-red-500">*</span>
              <input type="text" name="repoUrl" value={formData.repoUrl} onChange={handleInputChange} className="w-full border border-gray-300 p-2 mt-1 rounded focus:outline-none focus:border-blue-500 font-normal" />
            </label>
            <label className="text-gray-600 text-sm font-medium">
              NNP Repository Access Token<span className="text-red-500">*</span>
              <input type="password" name="repoToken" value={formData.repoToken} onChange={handleInputChange} className="w-full border border-gray-300 p-2 mt-1 rounded focus:outline-none focus:border-blue-500 font-normal" />
            </label>
            <label className="text-gray-600 text-sm font-medium">
              NNP Project Name<span className="text-red-500">*</span>
              <input type="text" name="projectName" value={formData.projectName} onChange={handleInputChange} className="w-full border border-gray-300 p-2 mt-1 rounded focus:outline-none focus:border-blue-500 font-normal" />
            </label>
          </div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="border border-gray-300 bg-white p-5 rounded shadow-sm h-full">
            <label className="block text-gray-600 text-sm font-medium mb-2">
              Select Requirement Document<span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2 relative">
              <input type="text" readOnly value={formData.requirementDocument?.name || ''} className="flex-1 border border-gray-300 p-2 rounded bg-gray-50 focus:outline-none text-gray-700" placeholder="No file selected..." />
              <div className="relative overflow-hidden inline-block">
                <button className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors h-full font-medium">
                  Browse File
                </button>
                <input type="file" onChange={handleFileChange} className="absolute left-0 top-0 opacity-0 cursor-pointer h-full w-full" />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-gray-600 text-sm font-medium mb-3">Generation Options</p>
              <div className="flex flex-col gap-2 pl-2">
                {[
                  { key: 'wbs', label: 'Agile Work Breakdown Structure' },
                  { key: 'designDoc', label: 'Design Document' },
                  { key: 'backendCode', label: 'Backend Code' },
                  { key: 'frontendCode', label: 'Frontend Code' },
                  { key: 'database', label: 'Database' },
                  { key: 'testScripts', label: 'Test Scripts' }
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.generationOptions[opt.key as keyof typeof formData.generationOptions]} 
                      onChange={() => handleCheckboxChange(opt.key as keyof typeof formData.generationOptions)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" 
                    /> 
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      <section className="border border-gray-300 bg-white p-5 rounded shadow-sm">
        <h4 className="text-gray-700 font-bold mb-4">Select Tech Stack</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          
          <div className="flex flex-col">
            <label className="text-gray-600 text-xs font-medium mb-1">Programming Language</label>
            <select name="language" value={formData.techStack.language} onChange={handleTechStackChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 bg-white text-gray-700">
              <option value="">Select...</option>
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="nodejs">Node.js</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-600 text-xs font-medium mb-1">Framework</label>
            <select name="framework" value={formData.techStack.framework} onChange={handleTechStackChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 bg-white text-gray-700">
              <option value="">Select...</option>
              <option value="springboot">Spring Boot</option>
              <option value="django">Django</option>
              <option value="express">Express</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-600 text-xs font-medium mb-1">UI Technology</label>
            <select name="uiTech" value={formData.techStack.uiTech} onChange={handleTechStackChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 bg-white text-gray-700">
              <option value="">Select...</option>
              <option value="react">React</option>
              <option value="angular">Angular</option>
              <option value="vue">Vue</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-600 text-xs font-medium mb-1">Database</label>
            <select name="database" value={formData.techStack.database} onChange={handleTechStackChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 bg-white text-gray-700">
              <option value="">Select...</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mongodb">MongoDB</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-gray-600 text-xs font-medium mb-1">Test Script</label>
            <select name="testScript" value={formData.techStack.testScript} onChange={handleTechStackChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500 bg-white text-gray-700">
              <option value="">Select...</option>
              <option value="jest">Jest</option>
              <option value="junit">JUnit</option>
              <option value="pytest">PyTest</option>
            </select>
          </div>

        </div>
        <div className="flex justify-end mt-6">
          <button 
            onClick={handleStartGeneration}
            disabled={executionStatus.isGenerating}
            className={`px-6 py-2 rounded transition-colors font-medium text-white shadow-sm ${executionStatus.isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-900'}`}
          >
            {executionStatus.isGenerating ? 'Generating...' : 'Start Generation'}
          </button>
        </div>
      </section>

      <section className="border border-gray-300 bg-white p-5 rounded shadow-sm">
        <h4 className="text-gray-700 font-bold mb-2">Execution Status</h4>
        <p className="text-gray-500 text-sm font-medium mb-3">{executionStatus.currentTask}</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-5 bg-gray-100 border border-gray-300 rounded overflow-hidden relative">
            <div 
              className="h-full bg-blue-500 transition-all duration-[800ms] ease-out flex items-center justify-center"
              style={{ width: `${executionStatus.progress}%` }}
            >
              {executionStatus.progress > 5 && (
                <span className="text-white text-xs font-bold">{executionStatus.progress}%</span>
              )}
            </div>
          </div>
          <button 
            onClick={() => setExecutionStatus({ isGenerating: false, progress: 0, currentTask: 'Cancelled by user' })}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-1.5 rounded transition-colors text-sm font-bold shadow-sm"
          >
            Cancel
          </button>
        </div>
      </section>

    </div>
  );
}

export default ModuleComponent;