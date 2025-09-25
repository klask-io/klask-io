#!/bin/bash

echo "🚀 Testing API Performance - Repository endpoints"
echo "================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get token from localStorage (you'll need to update this with a real token)
TOKEN="YOUR_TOKEN_HERE"
BASE_URL="http://localhost:3000"

echo ""
echo "📋 Testing /api/repositories (fast path - without stats)"
echo "--------------------------------------------------------"

start_time=$(date +%s%3N)
response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/repositories")
end_time=$(date +%s%3N)

http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
time_total=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')

duration=$((end_time - start_time))

if [ "$http_status" = "200" ]; then
    repo_count=$(echo "$body" | jq -r '.repositories | length' 2>/dev/null || echo "N/A")
    echo -e "${GREEN}✅ Success${NC}: ${duration}ms (${repo_count} repositories)"
    
    # Check if first repo has stats
    has_stats=$(echo "$body" | jq -r '.repositories[0].disk_size_mb != null' 2>/dev/null || echo "false")
    echo -e "   📊 Stats included: ${has_stats}"
else
    echo -e "${RED}❌ Error${NC}: HTTP $http_status (${duration}ms)"
    echo "   Response: $body"
fi

echo ""
echo "📈 Testing /api/repositories?include_stats=true (full stats)"
echo "-----------------------------------------------------------"

start_time=$(date +%s%3N)
response=$(curl -s -w "HTTPSTATUS:%{http_code};TIME:%{time_total}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/api/repositories?include_stats=true")
end_time=$(date +%s%3N)

http_status=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
time_total=$(echo "$response" | grep -o "TIME:[0-9.]*" | cut -d: -f2)
body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*;TIME:[0-9.]*$//')

duration=$((end_time - start_time))

if [ "$http_status" = "200" ]; then
    repo_count=$(echo "$body" | jq -r '.repositories | length' 2>/dev/null || echo "N/A")
    echo -e "${GREEN}✅ Success${NC}: ${duration}ms (${repo_count} repositories)"
    
    # Check if first repo has stats
    has_stats=$(echo "$body" | jq -r '.repositories[0].disk_size_mb != null' 2>/dev/null || echo "false")
    echo -e "   📊 Stats included: ${has_stats}"
else
    echo -e "${RED}❌ Error${NC}: HTTP $http_status (${duration}ms)"
    echo "   Response: $body"
fi

echo ""
echo "💡 Instructions to get token:"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to Application/Storage > Local Storage"
echo "   3. Find 'authToken' and copy its value"
echo "   4. Replace YOUR_TOKEN_HERE in this script"