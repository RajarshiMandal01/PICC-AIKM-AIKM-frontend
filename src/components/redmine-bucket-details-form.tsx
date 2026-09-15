import { useState } from 'react';
import kmApi, { KmApiError } from '../services/kmApiService';

interface RedmineBucketDetailsFormProps {
  bucketId: string;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  showErrorModal: (message: string, requestId: string | null) => void;
  showToast: (message: string) => void;
}

export const RedmineBucketDetailsForm = ({
  bucketId,
  onSubmitSuccess,
  onCancel,
  showErrorModal,
  showToast,
}: RedmineBucketDetailsFormProps) => {
  const [redmineUrl, setRedmineUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState('100');
  const [submitting, setSubmitting] = useState(false);

  const limitValue = Number(limit);
  const limitIsValid = Number.isInteger(limitValue) && limitValue >= 1;
  const redmineUrlIsValid = redmineUrl.trim().length > 0;
  const apiKeyIsValid = apiKey.trim().length > 0;
  const canSubmit = redmineUrlIsValid && apiKeyIsValid && limitIsValid && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketId || bucketId === 'new' || !canSubmit) return;

    setSubmitting(true);
    try {
      const payload = {
        bucket_id: bucketId,
        redmine_url: redmineUrl.trim(),
        api_key: apiKey.trim(),
        project_id: projectId.trim() || undefined,
        status: status.trim() || undefined,
        limit: limitValue,
      };

      await kmApi.post('/manageBucketDetails/createRedmineBucketDetails', payload);
      showToast('Redmine issues added. Ingestion started.');
      onSubmitSuccess();
    } catch (err) {
      showErrorModal(
        err instanceof KmApiError ? err.detail : 'Failed to add Redmine issues',
        err instanceof KmApiError ? err.requestId : null
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="url"
          value={redmineUrl}
          onChange={(e) => setRedmineUrl(e.target.value)}
          placeholder="Redmine URL *"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
          required
        />

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="API Key *"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          placeholder="Project ID (optional)"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
        />

        <input
          type="text"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="Status (optional, e.g. open)"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
        />

        <input
          type="number"
          min="1"
          step="1"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="Limit"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
        />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 rounded text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded text-sm font-medium transition-colors"
        >
          {submitting ? 'Adding...' : 'Add Redmine Issues'}
        </button>
      </div>
    </form>
  );
};

export default RedmineBucketDetailsForm;
