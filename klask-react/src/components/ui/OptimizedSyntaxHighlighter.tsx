import React, { Suspense, lazy, useMemo } from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import VirtualizedSyntaxHighlighter from './VirtualizedSyntaxHighlighter';

// Define the most commonly used languages in the codebase
const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'jsx', 'tsx', 'python', 'java', 'cpp', 'c',
  'csharp', 'php', 'ruby', 'go', 'rust', 'kotlin', 'swift', 'dart', 'scala',
  'bash', 'yaml', 'json', 'xml', 'html', 'css', 'scss', 'sass', 'less',
  'sql', 'markdown', 'dockerfile'
] as const;

type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

// Create a single, optimized syntax highlighter component
const SyntaxHighlighterComponent = lazy(async () => {
  // Import the core library and all needed languages at once
  const [
    { Prism },
    { default: javascript },
    { default: typescript },
    { default: jsx },
    { default: tsx },
    { default: python },
    { default: java },
    { default: cpp },
    { default: c },
    { default: csharp },
    { default: php },
    { default: ruby },
    { default: go },
    { default: rust },
    { default: kotlin },
    { default: swift },
    { default: dart },
    { default: scala },
    { default: bash },
    { default: yaml },
    { default: json },
    { default: markup }, // for HTML and XML
    { default: css },
    { default: scss },
    { default: sass },
    { default: less },
    { default: sql },
    { default: markdown },
    { default: docker },
  ] = await Promise.all([
    import('react-syntax-highlighter/dist/esm/prism'),
    import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
    import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
    import('react-syntax-highlighter/dist/esm/languages/prism/jsx'),
    import('react-syntax-highlighter/dist/esm/languages/prism/tsx'),
    import('react-syntax-highlighter/dist/esm/languages/prism/python'),
    import('react-syntax-highlighter/dist/esm/languages/prism/java'),
    import('react-syntax-highlighter/dist/esm/languages/prism/cpp'),
    import('react-syntax-highlighter/dist/esm/languages/prism/c'),
    import('react-syntax-highlighter/dist/esm/languages/prism/csharp'),
    import('react-syntax-highlighter/dist/esm/languages/prism/php'),
    import('react-syntax-highlighter/dist/esm/languages/prism/ruby'),
    import('react-syntax-highlighter/dist/esm/languages/prism/go'),
    import('react-syntax-highlighter/dist/esm/languages/prism/rust'),
    import('react-syntax-highlighter/dist/esm/languages/prism/kotlin'),
    import('react-syntax-highlighter/dist/esm/languages/prism/swift'),
    import('react-syntax-highlighter/dist/esm/languages/prism/dart'),
    import('react-syntax-highlighter/dist/esm/languages/prism/scala'),
    import('react-syntax-highlighter/dist/esm/languages/prism/bash'),
    import('react-syntax-highlighter/dist/esm/languages/prism/yaml'),
    import('react-syntax-highlighter/dist/esm/languages/prism/json'),
    import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
    import('react-syntax-highlighter/dist/esm/languages/prism/css'),
    import('react-syntax-highlighter/dist/esm/languages/prism/scss'),
    import('react-syntax-highlighter/dist/esm/languages/prism/sass'),
    import('react-syntax-highlighter/dist/esm/languages/prism/less'),
    import('react-syntax-highlighter/dist/esm/languages/prism/sql'),
    import('react-syntax-highlighter/dist/esm/languages/prism/markdown'),
    import('react-syntax-highlighter/dist/esm/languages/prism/docker'),
  ]);

  // Register all languages once
  Prism.registerLanguage('javascript', javascript);
  Prism.registerLanguage('typescript', typescript);
  Prism.registerLanguage('jsx', jsx);
  Prism.registerLanguage('tsx', tsx);
  Prism.registerLanguage('python', python);
  Prism.registerLanguage('java', java);
  Prism.registerLanguage('cpp', cpp);
  Prism.registerLanguage('c', c);
  Prism.registerLanguage('csharp', csharp);
  Prism.registerLanguage('php', php);
  Prism.registerLanguage('ruby', ruby);
  Prism.registerLanguage('go', go);
  Prism.registerLanguage('rust', rust);
  Prism.registerLanguage('kotlin', kotlin);
  Prism.registerLanguage('swift', swift);
  Prism.registerLanguage('dart', dart);
  Prism.registerLanguage('scala', scala);
  Prism.registerLanguage('bash', bash);
  Prism.registerLanguage('yaml', yaml);
  Prism.registerLanguage('json', json);
  Prism.registerLanguage('html', markup);
  Prism.registerLanguage('markup', markup);
  Prism.registerLanguage('xml', markup);
  Prism.registerLanguage('css', css);
  Prism.registerLanguage('scss', scss);
  Prism.registerLanguage('sass', sass);
  Prism.registerLanguage('less', less);
  Prism.registerLanguage('sql', sql);
  Prism.registerLanguage('markdown', markdown);
  Prism.registerLanguage('dockerfile', docker);

  return { default: Prism };
});

// Lazy load styles
const StylesComponent = lazy(async () => {
  const [oneLight, oneDark, vscDarkPlus] = await Promise.all([
    import('react-syntax-highlighter/dist/esm/styles/prism/one-light'),
    import('react-syntax-highlighter/dist/esm/styles/prism/one-dark'),
    import('react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus'),
  ]);

  return {
    default: {
      oneLight: oneLight.default,
      oneDark: oneDark.default,
      vscDarkPlus: vscDarkPlus.default,
    }
  };
});

interface OptimizedSyntaxHighlighterProps {
  language: string;
  children: string;
  style?: 'oneLight' | 'oneDark' | 'vscDarkPlus';
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  wrapLongLines?: boolean;
  customStyle?: React.CSSProperties;
  lineNumberStyle?: React.CSSProperties;
  className?: string;
  enableVirtualization?: boolean; // New prop to control virtualization
  maxLines?: number; // Threshold for virtualization
}

const OptimizedSyntaxHighlighter: React.FC<OptimizedSyntaxHighlighterProps> = ({
  language,
  children,
  style = 'vscDarkPlus',
  showLineNumbers = false,
  wrapLines = false,
  wrapLongLines = false,
  customStyle = {},
  lineNumberStyle = {},
  className = '',
  enableVirtualization = true,
  maxLines = 1000,
}) => {
  // Normalize language name and fallback to 'text' if not supported
  const normalizedLanguage = useMemo(() => {
    const lang = language.toLowerCase();
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage) ? lang : 'text';
  }, [language]);

  // Check if we should use virtualization for large files
  const shouldUseVirtualization = useMemo(() => {
    if (!enableVirtualization) return false;
    const lines = children.split('\n');
    return lines.length > maxLines || children.length > 100000; // 100KB threshold
  }, [children, enableVirtualization, maxLines]);

  // Use virtualized component for large files
  if (shouldUseVirtualization) {
    return (
      <VirtualizedSyntaxHighlighter
        language={normalizedLanguage}
        style={style}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
        customStyle={customStyle}
        lineNumberStyle={lineNumberStyle}
        className={className}
        maxLines={maxLines}
      >
        {children}
      </VirtualizedSyntaxHighlighter>
    );
  }

  return (
    <Suspense 
      fallback={
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner size="sm" className="mr-2" />
          <span className="text-sm text-gray-500">Loading syntax highlighter...</span>
        </div>
      }
    >
      <SyntaxHighlighterWrapper
        language={normalizedLanguage}
        style={style}
        showLineNumbers={showLineNumbers}
        wrapLines={wrapLines}
        wrapLongLines={wrapLongLines}
        customStyle={customStyle}
        lineNumberStyle={lineNumberStyle}
        className={className}
      >
        {children}
      </SyntaxHighlighterWrapper>
    </Suspense>
  );
};

interface SyntaxHighlighterWrapperProps extends OptimizedSyntaxHighlighterProps {}

const SyntaxHighlighterWrapper: React.FC<SyntaxHighlighterWrapperProps> = (props) => {
  return (
    <Suspense fallback={<div>Loading styles...</div>}>
      <ActualSyntaxHighlighter {...props} />
    </Suspense>
  );
};

const ActualSyntaxHighlighter: React.FC<SyntaxHighlighterWrapperProps> = ({
  language,
  children,
  style = 'vscDarkPlus',
  showLineNumbers = false,
  wrapLines = false,
  wrapLongLines = false,
  customStyle = {},
  lineNumberStyle = {},
  className = '',
}) => {
  const [SyntaxHighlighter, setHighlighter] = React.useState<any>(null);
  const [styles, setStyles] = React.useState<any>(null);

  React.useEffect(() => {
    Promise.all([
      SyntaxHighlighterComponent,
      StylesComponent,
    ]).then(([highlighterMod, stylesMod]) => {
      setHighlighter(highlighterMod.default);
      setStyles(stylesMod.default);
    });
  }, []);

  if (!SyntaxHighlighter || !styles) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner size="sm" className="mr-2" />
        <span className="text-sm text-gray-500">Loading syntax highlighter...</span>
      </div>
    );
  }

  const selectedStyle = styles[style] || styles.vscDarkPlus;

  return (
    <SyntaxHighlighter
      language={language}
      style={selectedStyle}
      showLineNumbers={showLineNumbers}
      wrapLines={wrapLines}
      wrapLongLines={wrapLongLines}
      customStyle={customStyle}
      lineNumberStyle={lineNumberStyle}
      className={className}
    >
      {children}
    </SyntaxHighlighter>
  );
};

export default OptimizedSyntaxHighlighter;