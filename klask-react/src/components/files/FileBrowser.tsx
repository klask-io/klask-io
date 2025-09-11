import React, { useState, useCallback } from 'react';
import { 
  FolderIcon, 
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useFileTree, type FileTreeNode } from '../../hooks/useFiles';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { formatFileSize, getFileIcon } from '../../lib/utils';

interface FileBrowserProps {
  project: string;
  selectedPath?: string;
  onFileSelect: (file: FileTreeNode) => void;
  onDirectorySelect?: (directory: FileTreeNode) => void;
  className?: string;
  showSearch?: boolean;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({
  project,
  selectedPath,
  onFileSelect,
  onDirectorySelect,
  className = '',
  showSearch = true,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['']));
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPath, setCurrentPath] = useState<string>('');

  const { data: fileTree, isLoading, error, refetch } = useFileTree(project, currentPath);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback((node: FileTreeNode) => {
    if (node.type === 'directory') {
      toggleExpanded(node.path);
      onDirectorySelect?.(node);
    } else {
      onFileSelect(node);
    }
  }, [toggleExpanded, onFileSelect, onDirectorySelect]);

  const filterNodes = useCallback((nodes: FileTreeNode[], searchTerm: string): FileTreeNode[] => {
    if (!searchTerm) return nodes;

    return nodes.filter(node => {
      const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (node.type === 'file') {
        return matchesSearch;
      }
      
      // For directories, include if name matches or any child matches
      const hasMatchingChildren = node.children && 
        filterNodes(node.children, searchTerm).length > 0;
      
      return matchesSearch || hasMatchingChildren;
    }).map(node => ({
      ...node,
      children: node.children ? filterNodes(node.children, searchTerm) : undefined,
    }));
  }, []);

  const renderNode = useCallback((node: FileTreeNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path} className="select-none">
        <div
          className={`flex items-center py-1 px-2 cursor-pointer hover:bg-slate-100 rounded transition-colors ${
            isSelected ? 'bg-blue-100 text-blue-800' : 'text-slate-700'
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => handleNodeClick(node)}
        >
          {node.type === 'directory' && (
            <div className="flex-shrink-0 mr-1">
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-slate-400" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-slate-400" />
                )
              ) : (
                <div className="h-4 w-4" />
              )}
            </div>
          )}
          
          <div className="flex-shrink-0 mr-2">
            {node.type === 'directory' ? (
              <FolderIcon className="h-4 w-4 text-blue-500" />
            ) : (
              getFileIcon(node.extension || '', 'h-4 w-4')
            )}
          </div>
          
          <span className="flex-1 text-sm font-medium truncate">
            {node.name}
          </span>
          
          {node.type === 'file' && node.size && (
            <span className="flex-shrink-0 text-xs text-slate-500 ml-2">
              {formatFileSize(node.size)}
            </span>
          )}
        </div>

        {node.type === 'directory' && isExpanded && node.children && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedPaths, selectedPath, handleNodeClick]);

  if (error) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="text-center text-slate-500">
          <DocumentIcon className="mx-auto h-12 w-12 mb-2" />
          <p className="text-sm">Failed to load file tree</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const filteredTree = fileTree ? filterNodes(fileTree, searchTerm) : [];

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-900">Files</h3>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {showSearch && (
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" className="mr-2" />
            <span className="text-sm text-slate-500">Loading files...</span>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <DocumentIcon className="mx-auto h-12 w-12 mb-2" />
            <p className="text-sm">
              {searchTerm ? 'No files match your search' : 'No files found'}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {filteredTree.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
};