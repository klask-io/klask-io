import React from 'react';
import { 
  DocumentTextIcon, 
  FolderIcon,
  ChevronRightIcon,
  EyeIcon,
  ArrowTopRightOnSquareIcon 
} from '@heroicons/react/24/outline';
import type { SearchResult as SearchResultType } from '../../types';

interface SearchResultProps {
  result: SearchResultType;
  query: string;
  onFileClick: (result: SearchResultType) => void;
  className?: string;
}

export const SearchResult: React.FC<SearchResultProps> = ({
  result,
  query,
  onFileClick,
  className = '',
}) => {

  const highlightQuery = (text: string, query: string): React.JSX.Element => {
    if (!query.trim()) return <>{text}</>;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={index} className="bg-yellow-200 font-semibold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const formatPath = (path: string): { directory: string; filename: string } => {
    if (!path) {
      return { directory: '', filename: '' };
    }
    const parts = path.split('/');
    const filename = parts.pop() || '';
    const directory = parts.join('/');
    return { directory, filename };
  };

  const { directory, filename } = formatPath(result.file_path);

  return (
    <div 
      className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}
    >
      {/* File Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1 text-sm text-gray-500">
                <FolderIcon className="h-4 w-4" />
                <span className="truncate">{directory}</span>
                <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
              </div>
              <div className="font-medium text-gray-900">
                {highlightQuery(filename, query)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
              {result.extension}
            </span>
            <span className="text-xs text-gray-500">
              Score: {(result.score * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        
        {/* Project and Version Info */}
        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
          <span>
            <span className="font-medium">Project:</span> {result.project}
          </span>
          <span>
            <span className="font-medium">Version:</span> {result.version}
          </span>
          {result.line_number && (
            <span>
              <span className="font-medium">Line:</span> {result.line_number}
            </span>
          )}
        </div>
      </div>

      {/* Code Preview */}
      <div className="p-4">
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={() => onFileClick(result)}
              className="inline-flex items-center space-x-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
            >
              <EyeIcon className="h-3 w-3" />
              <span>View File</span>
              <ArrowTopRightOnSquareIcon className="h-3 w-3" />
            </button>
          </div>
          
          <div className="overflow-hidden rounded border border-gray-200">
            <div 
              className="p-3 bg-gray-50 text-sm font-mono overflow-auto"
              style={{
                maxHeight: '200px',
                lineHeight: '1.5',
              }}
              dangerouslySetInnerHTML={{
                __html: result.content_snippet
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/&lt;b&gt;/g, '<mark class="bg-yellow-200 font-semibold">')
                  .replace(/&lt;\/b&gt;/g, '</mark>')
              }}
            />
          </div>
        </div>
        
        {/* Snippet Info */}
        <div className="mt-2 text-xs text-gray-500">
          Content preview • {result.content_snippet.length} characters
        </div>
      </div>
    </div>
  );
};