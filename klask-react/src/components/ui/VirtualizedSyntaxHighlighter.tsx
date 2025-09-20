import React, { useMemo, useState, useCallback } from 'react';
import { List } from 'react-window';
import OptimizedSyntaxHighlighter from './OptimizedSyntaxHighlighter';

interface VirtualizedSyntaxHighlighterProps {
  language: string;
  children: string;
  style?: 'oneLight' | 'oneDark' | 'vscDarkPlus';
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  customStyle?: React.CSSProperties;
  lineNumberStyle?: React.CSSProperties;
  className?: string;
  maxLines?: number; // Threshold for virtualization
  lineHeight?: number; // Height of each line in pixels
  containerHeight?: number; // Height of the container in pixels
}

const VirtualizedSyntaxHighlighter: React.FC<VirtualizedSyntaxHighlighterProps> = ({
  language,
  children,
  style = 'vscDarkPlus',
  showLineNumbers = false,
  wrapLines = false,
  customStyle = {},
  lineNumberStyle = {},
  className = '',
  maxLines = 1000, // Virtualize files with more than 1000 lines
  lineHeight = 22, // Default line height in pixels
  containerHeight = 600, // Default container height
}) => {
  const [viewMode, setViewMode] = useState<'auto' | 'syntax' | 'virtualized' | 'plain'>('auto');

  const lines = useMemo(() => {
    return children.split('\n');
  }, [children]);

  const shouldVirtualize = useMemo(() => {
    return lines.length > maxLines || children.length > 100000; // Also consider file size
  }, [lines.length, children.length, maxLines]);

  // Virtualized line component - moved outside conditional rendering to follow hook rules
  const LineItem = useCallback(({ index, style: itemStyle }: { index: number; style: React.CSSProperties }) => {
    const line = lines[index];
    const lineNumber = index + 1;
    
    return (
      <div style={itemStyle} className="flex">
        {showLineNumbers && (
          <div 
            className="select-none text-right px-3 flex-shrink-0 border-r border-gray-600"
            style={{
              minWidth: '60px',
              color: '#6e7681',
              backgroundColor: 'transparent',
              ...lineNumberStyle,
            }}
          >
            {lineNumber}
          </div>
        )}
        <div 
          className="flex-1 px-3 font-mono"
          style={{
            color: '#d4d4d4',
            fontSize: '14px',
            lineHeight: `${lineHeight}px`,
            whiteSpace: wrapLines ? 'pre-wrap' : 'pre',
            overflow: wrapLines ? 'visible' : 'hidden',
          }}
        >
          {line}
        </div>
      </div>
    );
  }, [lines, showLineNumbers, lineNumberStyle, lineHeight, wrapLines]);

  // Performance warning for very large files
  const isVeryLarge = lines.length > 5000 || children.length > 500000;

  // Determine what to render based on content size and user preference
  if (!shouldVirtualize || viewMode === 'syntax') {
    // Use optimized syntax highlighter for small files or when explicitly requested
    return (
      <OptimizedSyntaxHighlighter
        language={language}
        style={style}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
        customStyle={customStyle}
        lineNumberStyle={lineNumberStyle}
        className={className}
      >
        {children}
      </OptimizedSyntaxHighlighter>
    );
  }

  // Show warning for very large files when in auto mode
  if (isVeryLarge && viewMode === 'auto') {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-yellow-800">Large File Detected</h3>
            <p className="mt-1 text-sm text-yellow-700">
              This file has {lines.length.toLocaleString()} lines and may impact performance.
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('virtualized')}
              className="px-3 py-2 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
            >
              Show with Virtualization
            </button>
            <button
              onClick={() => setViewMode('plain')}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Show Plain Text
            </button>
          </div>
        </div>
        
        {viewMode === 'plain' && (
          <div className="mt-4">
            <pre 
              className={`whitespace-pre-wrap font-mono text-sm overflow-auto ${className}`}
              style={{
                padding: '24px',
                background: '#1e1e1e',
                color: '#d4d4d4',
                fontSize: '14px',
                lineHeight: '1.5',
                maxHeight: `${containerHeight}px`,
                ...customStyle,
              }}
            >
              {children}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Show plain text view when explicitly requested  
  if (viewMode === 'plain') {
    return (
      <div className="mt-4">
        <pre 
          className={`whitespace-pre-wrap font-mono text-sm overflow-auto ${className}`}
          style={{
            padding: '24px',
            background: '#1e1e1e',
            color: '#d4d4d4',
            fontSize: '14px',
            lineHeight: '1.5',
            maxHeight: `${containerHeight}px`,
            ...customStyle,
          }}
        >
          {children}
        </pre>
      </div>
    );
  }

  return (
    <div className={`border border-gray-600 rounded ${className}`}>
      {/* Header with file info */}
      <div className="bg-gray-800 text-gray-300 px-4 py-2 text-sm border-b border-gray-600">
        <span>
          Virtualized view: {lines.length.toLocaleString()} lines
{children.length > 1024 && ` • ${(children.length / 1024).toFixed(1)}KB`}
        </span>
        {!isVeryLarge && (
          <button
            onClick={() => setViewMode('syntax')}
            className="ml-4 text-blue-400 hover:text-blue-300"
          >
            Switch to syntax highlighting
          </button>
        )}
      </div>
      
      {/* Virtualized content */}
      <div
        style={{
          background: '#1e1e1e',
          ...customStyle,
        }}
      >
        <List
          height={containerHeight}
          itemCount={lines.length}
          itemSize={lineHeight}
          width="100%"
          {...({} as any)}
        >
          {LineItem as any}
        </List>
      </div>
    </div>
  );
};

export default VirtualizedSyntaxHighlighter;