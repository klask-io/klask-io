import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { 
  TrashIcon, 
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface IndexResetResponse {
  success: boolean;
  message: string;
  documents_before: number;
  documents_after: number;
}

export const IndexManagement: React.FC = () => {
  const [showResetDialog, setShowResetDialog] = useState(false);
  const queryClient = useQueryClient();

  const resetIndexMutation = useMutation({
    mutationFn: async (): Promise<IndexResetResponse> => {
      const response = await api.post('/api/admin/search/reset-index');
      return response;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Index reset successfully. ${data.documents_before} documents removed.`);
        queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'search', 'stats'] });
      } else {
        toast.error(`Reset failed: ${data.message}`);
      }
      setShowResetDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Failed to reset index: ${error.response?.data?.message || error.message}`);
      setShowResetDialog(false);
    },
  });


  const handleResetIndex = () => {
    resetIndexMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Index Management</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage the Tantivy search index used for file content search.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Search Index Operations</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage the Tantivy search index. Files are indexed directly during crawling.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Reset Index Section */}
          <div className="border border-red-200 rounded-lg p-4 bg-red-50">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-medium text-red-900 mb-2">Reset Search Index</h3>
                <p className="text-sm text-red-700 mb-4">
                  This will completely delete all documents from the search index. 
                  All search functionality will be unavailable until repositories are crawled again.
                  <strong className="block mt-2">This action cannot be undone.</strong>
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowResetDialog(true)}
                  disabled={resetIndexMutation.isPending}
                  className="flex items-center"
                >
                  {resetIndexMutation.isPending ? (
                    <LoadingSpinner size="sm" className="mr-2" />
                  ) : (
                    <TrashIcon className="h-4 w-4 mr-2" />
                  )}
                  Reset Index
                </Button>
              </div>
            </div>
          </div>


          {/* Additional Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">When to use this operation:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong>Reset Index:</strong> When you want to completely clear the search index</li>
                  <li><strong>To re-populate the index:</strong> Use the crawl buttons in Repositories instead</li>
                  <li><strong>Important:</strong> Files are indexed directly during repository crawling</li>
                  <li>This operation requires administrator privileges</li>
                  <li>Search functionality will be unavailable until repositories are crawled again</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onConfirm={handleResetIndex}
        title="Reset Search Index"
        message="Are you sure you want to reset the search index? This will delete all indexed documents and cannot be undone. Search functionality will be unavailable until files are reindexed."
        confirmText="Reset Index"
        cancelText="Cancel"
        variant="danger"
      />

    </div>
  );
};

export default IndexManagement;