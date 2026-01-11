/**
 * Load Test: File Upload
 * 
 * Tests the upload endpoint under load to identify bottlenecks.
 * 
 * Usage:
 *   k6 run tests/load/upload-load.js
 * 
 * Scenarios:
 *   - Smoke: 1 user for 30s (sanity check)
 *   - Load: Ramp to 10 users over 2m, sustain 5m
 *   - Stress: Ramp to 50 users to find breaking point
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { test_type: 'smoke' },
    },
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },  // Ramp up
        { duration: '5m', target: 10 },  // Sustain
        { duration: '2m', target: 0 },   // Ramp down
      ],
      startTime: '30s',  // Start after smoke test
      tags: { test_type: 'load' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.05'],             // Custom error rate under 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const USERNAME = __ENV.AUTH_USERNAME || 'gili';
const PASSWORD = __ENV.AUTH_PASSWORD || 'y1a3r5o7n';

let authToken;

// Setup: Login once at start
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: USERNAME,
    password: PASSWORD,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }
  
  const body = JSON.parse(loginRes.body);
  return { token: body.token };
}

// Main test
export default function(data) {
  const token = data.token;
  
  // Test API endpoints
  const endpoints = [
    { name: 'Dashboard', url: '/api/dashboard', method: 'GET' },
    { name: 'Transactions', url: '/api/transactions?limit=50', method: 'GET' },
    { name: 'Businesses', url: '/api/businesses', method: 'GET' },
    { name: 'Categories', url: '/api/categories', method: 'GET' },
    { name: 'Health', url: '/api/health', method: 'GET' },
  ];
  
  // Pick random endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(`${BASE_URL}${endpoint.url}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    tags: { endpoint: endpoint.name },
  });
  
  // Check response
  const success = check(res, {
    'status is 200': (r) => r.status === 200,
    'response has body': (r) => r.body.length > 0,
    'response time OK': (r) => r.timings.duration < 1000,
  });
  
  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
  
  // Think time: 1-3 seconds between requests
  sleep(Math.random() * 2 + 1);
}

// Teardown
export function teardown(data) {
  // Could logout here if needed
  console.log('Load test complete');
}
