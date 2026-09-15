import { useState } from 'react';
import kmApi, { KmApiError } from '../services/kmApiService';

interface GitRepositoryFormProps {
  bucketId: string;
  onSubmitSuccess: () => void;
  onCancel: () => void;
  showErrorModal: (message: string, requestId: string | null) => void;
  showToast: (message: string) => void;
}

export const GitRepositoryForm = ({
  bucketId,
  onSubmitSuccess,
  onCancel,
  showErrorModal,
  showToast,
}: GitRepositoryFormProps) => {
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  const [gitUsername, setGitUsername] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketId || bucketId === 'new') return;
    if (!gitRepoUrl.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        bucket_id: bucketId,
        repo_url: gitRepoUrl.trim(),
        branch: gitBranch.trim() || undefined,
        username: gitUsername.trim() || undefined,
        token: gitToken.trim() || undefined,
      };

      await kmApi.post('/manageBucketDetails/createGitBucketDetails', payload);
      showToast('Repository added. Ingestion started.');
      onSubmitSuccess();
    } catch (err) {
      showErrorModal(
        err instanceof KmApiError ? err.detail : 'Failed to add repository',
        err instanceof KmApiError ? err.requestId : null
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <input
          type="url"
          value={gitRepoUrl}
          onChange={(e) => setGitRepoUrl(e.target.value)}
          placeholder="Repository URL * (e.g. https://github.com/user/repo.git)"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          type="text"
          value={gitBranch}
          onChange={(e) => setGitBranch(e.target.value)}
          placeholder="Branch (optional, e.g. main)"
          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
        />

        <div className="relative flex items-center w-full">
          <input
            type="text"
            value={gitUsername}
            onChange={(e) => setGitUsername(e.target.value)}
            placeholder="Username (optional)"
            className="w-full border border-gray-300 rounded pl-3 pr-8 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
          />
          <div
            className="absolute right-2.5 cursor-help"
            title="Username is required for private repositories"
          >
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="relative flex items-center w-full">
          <input
            type="password"
            value={gitToken}
            onChange={(e) => setGitToken(e.target.value)}
            placeholder="Personal Access Token (optional)"
            className="w-full border border-gray-300 rounded pl-3 pr-8 py-1.5 text-sm bg-gray-50 focus:outline-none focus:border-[#4a77b4] focus:ring-1 focus:ring-[#4a77b4]"
          />
          <div
            className="absolute right-2.5 cursor-help"
            title="Personal Access Token is required for private repositories"
          >
            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
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
          disabled={!gitRepoUrl.trim() || submitting}
          className="bg-[#4a77b4] hover:bg-[#3a6094] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-1.5 rounded text-sm font-medium transition-colors"
        >
          {submitting ? 'Adding…' : 'Add Repository'}
        </button>
      </div>
    </form>
  );
};

export default GitRepositoryForm;
