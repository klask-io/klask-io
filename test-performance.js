#!/usr/bin/env node

// Script de test simple pour mesurer la performance de l'API repositories
const { performance } = require('perf_hooks');

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const TOKEN = process.env.AUTH_TOKEN || '';

async function testEndpoint(path, description) {
  console.log(`\n🔍 Testing: ${description}`);
  console.log(`   URL: ${API_BASE}${path}`);
  
  const start = performance.now();
  
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Authorization': TOKEN ? `Bearer ${TOKEN}` : '',
        'Content-Type': 'application/json'
      }
    });
    
    const end = performance.now();
    const duration = Math.round(end - start);
    
    if (response.ok) {
      const data = await response.json();
      const repoCount = data.repositories ? data.repositories.length : 0;
      console.log(`   ✅ Success: ${duration}ms (${repoCount} repositories)`);
      
      // Analyze stats presence
      if (data.repositories && data.repositories.length > 0) {
        const firstRepo = data.repositories[0];
        const hasStats = firstRepo.disk_size_mb !== null && firstRepo.file_count !== null;
        console.log(`   📊 Stats included: ${hasStats ? 'Yes' : 'No'}`);
      }
      
      return { success: true, duration, count: repoCount };
    } else {
      console.log(`   ❌ Error: ${response.status} ${response.statusText} (${duration}ms)`);
      return { success: false, duration, error: response.statusText };
    }
  } catch (error) {
    const end = performance.now();
    const duration = Math.round(end - start);
    console.log(`   💥 Failed: ${error.message} (${duration}ms)`);
    return { success: false, duration, error: error.message };
  }
}

async function main() {
  console.log('🚀 Performance Test - Repository API');
  console.log('=====================================');
  
  // Test fast endpoint (without stats)
  const fastResult = await testEndpoint('/api/repositories', 'Fast load (without stats)');
  
  // Test slow endpoint (with stats)  
  const slowResult = await testEndpoint('/api/repositories?include_stats=true', 'Full load (with stats)');
  
  console.log('\n📈 Results Summary');
  console.log('==================');
  
  if (fastResult.success && slowResult.success) {
    const improvement = Math.round(((slowResult.duration - fastResult.duration) / slowResult.duration) * 100);
    console.log(`Fast endpoint: ${fastResult.duration}ms`);
    console.log(`Full endpoint: ${slowResult.duration}ms`);
    console.log(`Speed improvement: ${improvement}% faster without stats`);
    
    if (fastResult.duration < 500) {
      console.log('✅ Fast endpoint meets performance target (<500ms)');
    } else {
      console.log('⚠️  Fast endpoint still slow (>500ms)');
    }
  }
  
  console.log('\n💡 Recommendation:');
  console.log('   Use fast endpoint for initial page load');
  console.log('   Load stats on-demand or in background');
}

if (require.main === module) {
  main().catch(console.error);
}