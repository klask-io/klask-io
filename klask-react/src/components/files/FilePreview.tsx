import React, { useState, useMemo } from 'react';
import OptimizedSyntaxHighlighter from '../ui/OptimizedSyntaxHighlighter';
import {
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { useFile, useFileContent } from '../../hooks/useFiles';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatFileSize, formatDistanceToNow, getLanguageFromExtension } from '../../lib/utils';
import type { File } from '../../types';

interface FilePreviewProps {
  fileId?: string;
  file?: File;
  className?: string;
  maxHeight?: string;
  showMetadata?: boolean;
  showLineNumbers?: boolean;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  fileId,
  file: providedFile,
  className = '',
  maxHeight = '600px',
  showMetadata = true,
  showLineNumbers = true,
}) => {
  const [showRawContent, setShowRawContent] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Fetch file data if not provided
  const { data: fetchedFile, isLoading: fileLoading, error: fileError } = useFile(fileId || '');

  // Fetch file content
  const file = providedFile || fetchedFile;
  const { data: content, isLoading: contentLoading, error: contentError } = useFileContent(file?.id || '');

  const isLoading = fileLoading || contentLoading;
  const error = fileError || contentError;

  const fileType = useMemo(() => {
    if (!file) return 'unknown';
    
    const ext = file.extension.toLowerCase();
    
    // Text/code files
    if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'css', 'scss', 'html', 'xml', 'yaml', 'yml', 'toml', 'ini', 'conf', 'sh', 'bash', 'sql', 'rs', 'go', 'php', 'rb', 'swift', 'kt', 'scala', 'dart', 'vue', 'svelte'].includes(ext)) {
      return 'text';
    }
    
    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) {
      return 'image';
    }
    
    // Videos
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv'].includes(ext)) {
      return 'video';
    }
    
    // Audio
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext)) {
      return 'audio';
    }
    
    // Archives
    if (['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz'].includes(ext)) {
      return 'archive';
    }
    
    // Binary/other
    return 'binary';
  }, [file]);

  const language = useMemo(() => {
    if (!file || fileType !== 'text') return 'text';
    return getLanguageFromExtension(file.extension);
  }, [file, fileType]);

  const handleCopyContent = async () => {
    if (!content) return;
    
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  const getFileTypeIcon = () => {
    switch (fileType) {
      case 'text':
        return <DocumentTextIcon className="h-16 w-16 text-slate-400" />;
      case 'image':
        return <PhotoIcon className="h-16 w-16 text-green-400" />;
      case 'video':
        return <FilmIcon className="h-16 w-16 text-purple-400" />;
      case 'audio':
        return <MusicalNoteIcon className="h-16 w-16 text-blue-400" />;
      case 'archive':
        return <ArchiveBoxIcon className="h-16 w-16 text-orange-400" />;
      default:
        return <DocumentIcon className="h-16 w-16 text-slate-400" />;
    }
  };

  if (!file && !fileId) {
    return (
      <div className={`flex items-center justify-center p-8 bg-slate-50 rounded-lg ${className}`}>
        <div className="text-center">
          <DocumentIcon className="mx-auto h-16 w-16 text-slate-300 mb-4" />
          <p className="text-slate-500">Select a file to preview</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <LoadingSpinner size="lg" className="mr-3" />
        <span className="text-slate-600">Loading file...</span>
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className={`p-8 text-center ${className}`}>
        <DocumentIcon className="mx-auto h-16 w-16 text-red-300 mb-4" />
        <p className="text-red-600 mb-2">Failed to load file</p>
        <p className="text-sm text-slate-500">
          {error?.message || 'File not found'}
        </p>
      </div>
    );
  }

  const renderContent = () => {
    if (!content && fileType === 'text') {
      return (
        <div className="text-center py-8 text-slate-500">
          <DocumentTextIcon className="mx-auto h-12 w-12 mb-2" />
          <p>No content available</p>
        </div>
      );
    }

    switch (fileType) {
      case 'text':
        if (showRawContent) {
          return (
            <pre className="whitespace-pre-wrap font-mono text-sm p-4 bg-slate-50 rounded overflow-auto"
                 style={{ maxHeight }}>
              {content}
            </pre>
          );
        }
        
        return (
          <div className="rounded overflow-hidden" style={{ maxHeight }}>
            <OptimizedSyntaxHighlighter
              language={language}
              style="vscDarkPlus"
              showLineNumbers={showLineNumbers}
              customStyle={{
                margin: 0,
                maxHeight,
                fontSize: '14px',
              }}
              wrapLongLines
            >
              {content || ''}
            </OptimizedSyntaxHighlighter>
          </div>
        );

      case 'image':
        return (
          <div className="text-center py-8">
            <img
              src={`/api/files/${file.id}/content`}
              alt={file.name}
              className="max-w-full max-h-96 mx-auto rounded shadow"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextSibling) nextSibling.style.display = 'block';
              }}
            />
            <div className="hidden text-slate-500">
              <PhotoIcon className="mx-auto h-16 w-16 mb-2" />
              <p>Failed to load image</p>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="text-center py-8">
            <video
              controls
              className="max-w-full max-h-96 mx-auto rounded shadow"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextSibling) nextSibling.style.display = 'block';
              }}
            >
              <source src={`/api/files/${file.id}/content`} />
              Your browser does not support the video tag.
            </video>
            <div className="hidden text-slate-500">
              <FilmIcon className="mx-auto h-16 w-16 mb-2" />
              <p>Cannot preview video file</p>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="text-center py-8">
            <MusicalNoteIcon className="mx-auto h-16 w-16 text-blue-400 mb-4" />
            <audio controls className="w-full max-w-md">
              <source src={`/api/files/${file.id}/content`} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-slate-500">
            {getFileTypeIcon()}
            <p className="mt-4">Cannot preview this file type</p>
            <a
              href={`/api/files/${file.id}/content`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-800"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-1" />
              Open in new tab
            </a>
          </div>
        );
    }
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`}>
      {/* Header */}
      {showMetadata && (
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-slate-900 truncate">
                {file.name}
              </h3>
              <div className="mt-1 flex items-center space-x-4 text-sm text-slate-500">
                <span>{file.path}</span>
                <span>{formatFileSize(file.size)}</span>
                <span>Modified {formatDistanceToNow(file.lastModified)}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 ml-4">
              {fileType === 'text' && (
                <>
                  <button
                    onClick={() => setShowRawContent(!showRawContent)}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    title={showRawContent ? 'Show syntax highlighting' : 'Show raw content'}
                  >
                    {showRawContent ? (
                      <EyeIcon className="h-4 w-4" />
                    ) : (
                      <EyeSlashIcon className="h-4 w-4" />
                    )}
                  </button>
                  
                  <button
                    onClick={handleCopyContent}
                    className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Copy content"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </>
              )}
              
              <a
                href={`/api/files/${file.id}/content`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                title="Open in new tab"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            </div>
          </div>
          
          {copySuccess && (
            <div className="mt-2 text-sm text-green-600">
              Content copied to clipboard!
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};