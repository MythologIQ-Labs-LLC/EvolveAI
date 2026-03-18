const fetch = require('node-fetch');

async function testAIStudioAPI() {
  console.log('Testing AI Studio API...\n');

  const testCases = [
    {
      name: 'Empty API Key',
      data: { apiKey: '' },
      expectedError: 'API key is required'
    },
    {
      name: 'Invalid API Key Format',
      data: { apiKey: 'invalid' },
      expectedError: 'Invalid API key format'
    },
    {
      name: 'Valid API Key Format (Test)',
      data: { apiKey: 'AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz' },
      expectedError: null // This will fail with real API key, but format is correct
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    
    try {
      const response = await fetch('http://localhost:3000/api/ai-studio/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testCase.data),
      });

      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Success:', data.message || 'API working');
      } else {
        console.log('❌ Error:', data.error);
        
        if (testCase.expectedError && data.error.includes(testCase.expectedError)) {
          console.log('✅ Expected error received');
        } else {
          console.log('⚠️  Unexpected error');
        }
      }
    } catch (error) {
      console.log('❌ Network error:', error.message);
    }
    
    console.log('');
  }

  console.log('Test completed!');
}

testAIStudioAPI().catch(console.error); 