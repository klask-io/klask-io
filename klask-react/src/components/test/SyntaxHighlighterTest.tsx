import React, { useState } from 'react';
import OptimizedSyntaxHighlighter from '../ui/OptimizedSyntaxHighlighter';

const SyntaxHighlighterTest: React.FC = () => {
  const [testCase, setTestCase] = useState<string>('javascript');

  const testCases = {
    javascript: {
      language: 'javascript',
      code: `import React, { useState, useEffect } from 'react';
import { fetchData } from './api';

const MyComponent = ({ userId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const result = await fetchData(userId);
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadData();
    }
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>User Data</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default MyComponent;`
    },
    python: {
      language: 'python',
      code: `import asyncio
import aiohttp
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class User:
    id: int
    name: str
    email: str
    created_at: datetime
    
    def is_recent(self, days: int = 30) -> bool:
        """Check if user was created within the last N days."""
        cutoff = datetime.now() - timedelta(days=days)
        return self.created_at > cutoff
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'User':
        return cls(
            id=data['id'],
            name=data['name'],
            email=data['email'],
            created_at=datetime.fromisoformat(data['created_at'])
        )

class UserService:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_users(self, limit: int = 100) -> List[User]:
        """Fetch users from the API."""
        if not self.session:
            raise RuntimeError("Service not initialized")
        
        async with self.session.get(
            f"{self.base_url}/users",
            params={"limit": limit}
        ) as response:
            response.raise_for_status()
            data = await response.json()
            return [User.from_dict(user_data) for user_data in data]

async def main():
    async with UserService("https://api.example.com") as service:
        users = await service.get_users(50)
        recent_users = [user for user in users if user.is_recent()]
        
        print(f"Found {len(recent_users)} recent users:")
        for user in recent_users:
            print(f"  {user.name} ({user.email})")

if __name__ == "__main__":
    asyncio.run(main())`
    },
    rust: {
      language: 'rust',
      code: `use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct File {
    pub id: Uuid,
    pub name: String,
    pub path: String,
    pub content: Option<String>,
    pub project: String,
    pub version: String,
    pub extension: String,
    pub size: i64,
    pub last_modified: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct SearchService {
    files: Arc<Mutex<HashMap<Uuid, File>>>,
    index: Arc<Mutex<HashMap<String, Vec<Uuid>>>>,
}

impl SearchService {
    pub fn new() -> Self {
        Self {
            files: Arc::new(Mutex::new(HashMap::new())),
            index: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    pub async fn add_file(&self, file: File) -> Result<(), Box<dyn std::error::Error>> {
        let file_id = file.id;
        let content = file.content.clone().unwrap_or_default();
        
        // Add file to storage
        {
            let mut files = self.files.lock().await;
            files.insert(file_id, file);
        }
        
        // Update search index
        self.index_content(file_id, &content).await?;
        
        Ok(())
    }
    
    async fn index_content(&self, file_id: Uuid, content: &str) -> Result<(), Box<dyn std::error::Error>> {
        let words: Vec<String> = content
            .split_whitespace()
            .map(|word| word.to_lowercase())
            .filter(|word| word.len() > 2)
            .collect();
        
        let mut index = self.index.lock().await;
        for word in words {
            index.entry(word).or_insert_with(Vec::new).push(file_id);
        }
        
        Ok(())
    }
    
    pub async fn search(&self, query: &str) -> Result<Vec<File>, Box<dyn std::error::Error>> {
        let query_words: Vec<String> = query
            .split_whitespace()
            .map(|word| word.to_lowercase())
            .collect();
        
        let index = self.index.lock().await;
        let files = self.files.lock().await;
        
        let mut results = Vec::new();
        let mut file_scores: HashMap<Uuid, usize> = HashMap::new();
        
        // Score files based on query word matches
        for word in &query_words {
            if let Some(file_ids) = index.get(word) {
                for &file_id in file_ids {
                    *file_scores.entry(file_id).or_insert(0) += 1;
                }
            }
        }
        
        // Sort by score and collect results
        let mut scored_files: Vec<(Uuid, usize)> = file_scores.into_iter().collect();
        scored_files.sort_by(|a, b| b.1.cmp(&a.1));
        
        for (file_id, _score) in scored_files.into_iter().take(10) {
            if let Some(file) = files.get(&file_id) {
                results.push(file.clone());
            }
        }
        
        Ok(results)
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let search_service = SearchService::new();
    
    // Add sample files
    let sample_file = File {
        id: Uuid::new_v4(),
        name: "main.rs".to_string(),
        path: "src/main.rs".to_string(),
        content: Some("fn main() { println!(\"Hello, world!\"); }".to_string()),
        project: "my-project".to_string(),
        version: "main".to_string(),
        extension: "rs".to_string(),
        size: 42,
        last_modified: Utc::now(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    
    search_service.add_file(sample_file).await?;
    
    // Search for files
    let results = search_service.search("main").await?;
    println!("Found {} files matching 'main'", results.len());
    
    for file in results {
        println!("  {} ({})", file.name, file.path);
    }
    
    Ok(())
}`
    },
    large: {
      language: 'javascript',
      code: Array(2000).fill(0).map((_, i) => 
        `// Line ${i + 1}: This is a test line to demonstrate virtualization
function testFunction${i}() {
  const data = {
    id: ${i},
    name: "test${i}",
    value: Math.random() * 1000,
    timestamp: new Date().toISOString()
  };
  
  console.log(\`Processing item \${data.id}: \${data.name}\`);
  
  return data;
}`).join('\n\n')
    }
  };

  const currentTest = testCases[testCase as keyof typeof testCases];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Syntax Highlighter Test</h1>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Test Case:
          </label>
          <select 
            value={testCase}
            onChange={(e) => setTestCase(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="javascript">JavaScript/React</option>
            <option value="python">Python</option>
            <option value="rust">Rust</option>
            <option value="large">Large File (2000+ lines)</option>
          </select>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          <p><strong>Language:</strong> {currentTest.language}</p>
          <p><strong>Lines:</strong> {currentTest.code.split('\n').length}</p>
          <p><strong>Size:</strong> {(currentTest.code.length / 1024).toFixed(1)}KB</p>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Code Preview - {currentTest.language}
          </h2>
        </div>
        
        <div className="bg-white">
          <OptimizedSyntaxHighlighter
            language={currentTest.language}
            showLineNumbers={true}
            style="oneLight"
            customStyle={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          >
            {currentTest.code}
          </OptimizedSyntaxHighlighter>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>This test component verifies that:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Syntax highlighting loads correctly without infinite loading</li>
          <li>Different programming languages are properly highlighted</li>
          <li>Large files (2000+ lines) show performance warnings</li>
          <li>Loading states work as expected</li>
          <li>Fallbacks work for very large files</li>
        </ul>
      </div>
    </div>
  );
};

export default SyntaxHighlighterTest;