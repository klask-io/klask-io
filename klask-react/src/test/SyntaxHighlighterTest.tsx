import React from 'react';
import OptimizedSyntaxHighlighter from '../components/ui/OptimizedSyntaxHighlighter';

const sampleJavaScript = `
// Sample JavaScript code to test syntax highlighting
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(x => x * 2);

console.log('Fibonacci of 10:', fibonacci(10));
console.log('Doubled numbers:', doubled);
`;

const samplePython = `
# Sample Python code to test syntax highlighting
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

numbers = [1, 2, 3, 4, 5]
doubled = [x * 2 for x in numbers]

print(f"Fibonacci of 10: {fibonacci(10)}")
print(f"Doubled numbers: {doubled}")
`;

const largeSampleCode = Array(2000).fill(0).map((_, i) => 
  `// Line ${i + 1}: This is a sample line to test virtualization
const variable${i} = "This is line ${i + 1}";
console.log(variable${i});`
).join('\n');

export const SyntaxHighlighterTest: React.FC = () => {
  const [activeTest, setActiveTest] = React.useState<'js' | 'python' | 'large'>('js');

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold mb-4">Syntax Highlighter Performance Test</h2>
        
        <div className="flex space-x-4 mb-6">
          <button
            onClick={() => setActiveTest('js')}
            className={`px-4 py-2 rounded ${
              activeTest === 'js' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            JavaScript (Small)
          </button>
          <button
            onClick={() => setActiveTest('python')}
            className={`px-4 py-2 rounded ${
              activeTest === 'python' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Python (Small)
          </button>
          <button
            onClick={() => setActiveTest('large')}
            className={`px-4 py-2 rounded ${
              activeTest === 'large' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Large File (2000 lines)
          </button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          {activeTest === 'js' && (
            <OptimizedSyntaxHighlighter
              language="javascript"
              style="vscDarkPlus"
              showLineNumbers={true}
            >
              {sampleJavaScript}
            </OptimizedSyntaxHighlighter>
          )}
          
          {activeTest === 'python' && (
            <OptimizedSyntaxHighlighter
              language="python"
              style="oneLight"
              showLineNumbers={true}
            >
              {samplePython}
            </OptimizedSyntaxHighlighter>
          )}
          
          {activeTest === 'large' && (
            <OptimizedSyntaxHighlighter
              language="javascript"
              style="vscDarkPlus"
              showLineNumbers={true}
              enableVirtualization={true}
              maxLines={500}
            >
              {largeSampleCode}
            </OptimizedSyntaxHighlighter>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <h3 className="font-semibold mb-2">Performance Optimizations Implemented:</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Dynamic imports for syntax highlighter languages (reduces initial bundle size)</li>
            <li>Lazy loading of syntax highlighter components</li>
            <li>Automatic virtualization for large files (&gt;1000 lines or &gt;100KB)</li>
            <li>Optimized Vite configuration to bundle languages efficiently</li>
            <li>Fallback to plain text for extremely large files (&gt;50KB)</li>
            <li>Suspense-based loading with proper fallbacks</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SyntaxHighlighterTest;