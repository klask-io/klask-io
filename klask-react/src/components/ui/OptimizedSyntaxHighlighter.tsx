import React, { Suspense, lazy } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import VirtualizedSyntaxHighlighter from './VirtualizedSyntaxHighlighter';

// Lazy load react-syntax-highlighter
const SyntaxHighlighter = lazy(() => import('react-syntax-highlighter').then(module => ({
  default: module.Prism
})));

// Lazy load styles
const loadStyles = async (styleName: 'oneLight' | 'oneDark' | 'vscDarkPlus') => {
  try {
    const styles = await import('react-syntax-highlighter/dist/esm/styles/prism');
    if (styleName === 'oneDark') {
      return styles.oneDark;
    } else if (styleName === 'vscDarkPlus') {
      return styles.vscDarkPlus;
    } else {
      return styles.oneLight || styles.prism;
    }
  } catch (error) {
    console.warn('Failed to load syntax highlighting style:', error);
    // Return a basic style as fallback
    return {};
  }
};

interface OptimizedSyntaxHighlighterProps {
  children: string;
  language: string;
  style?: 'oneLight' | 'oneDark' | 'vscDarkPlus';
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  wrapLongLines?: boolean;
  customStyle?: React.CSSProperties;
  lineNumberStyle?: React.CSSProperties;
  className?: string;
  enableVirtualization?: boolean;
  maxLines?: number;
  lineHeight?: number;
  containerHeight?: number;
}

const OptimizedSyntaxHighlighter: React.FC<OptimizedSyntaxHighlighterProps> = ({
  children,
  language,
  style = 'oneLight',
  showLineNumbers = true,
  wrapLines = false,
  wrapLongLines = false,
  customStyle = {},
  lineNumberStyle = {},
  className = '',
  enableVirtualization = true,
  maxLines = 1000,
  lineHeight = 22,
  containerHeight = 600
}) => {
  const [loadedStyle, setLoadedStyle] = React.useState<any>(null);

  React.useEffect(() => {
    loadStyles(style).then(styleObj => {
      setLoadedStyle(styleObj);
    });
  }, [style]);

  // Check if we should use virtualization
  const lines = React.useMemo(() => children.split('\n'), [children]);
  const shouldVirtualize = React.useMemo(() => {
    return enableVirtualization && (lines.length > maxLines || children.length > 100000);
  }, [enableVirtualization, lines.length, children.length, maxLines]);

  // Use virtualized highlighter for large content
  if (shouldVirtualize) {
    return (
      <VirtualizedSyntaxHighlighter
        language={language}
        style={style}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
        customStyle={customStyle}
        lineNumberStyle={lineNumberStyle}
        className={className}
        maxLines={maxLines}
        lineHeight={lineHeight}
        containerHeight={containerHeight}
      >
        {children}
      </VirtualizedSyntaxHighlighter>
    );
  }

  // If content is too large, show a warning and use plain text
  if (children.length > 50000) {
    return (
      <div style={customStyle} className="p-4 bg-gray-50 border rounded">
        <div className="mb-4 p-2 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-700">
          <p className="font-medium">Large File Warning</p>
          <p className="text-sm">This file is very large ({(children.length / 1024).toFixed(1)}KB). Syntax highlighting has been disabled for performance.</p>
        </div>
        <pre className="whitespace-pre-wrap text-sm font-mono overflow-auto">
          {children}
        </pre>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8" style={customStyle}>
        <div className="text-center">
          <LoadingSpinner size="sm" className="mb-2" />
          <p className="text-sm text-gray-500">Loading syntax highlighter...</p>
        </div>
      </div>
    }>
      <SyntaxHighlighter
        language={language}
        style={loadedStyle || {}}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
        wrapLongLines={wrapLongLines}
        customStyle={customStyle}
        lineNumberStyle={lineNumberStyle}
        className={className}
      >
        {children}
      </SyntaxHighlighter>
    </Suspense>
  );
};

export default OptimizedSyntaxHighlighter;