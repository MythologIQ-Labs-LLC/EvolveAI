import { FreeAPIService } from '../lib/free-api-service.js';

async function testAPIs() {
  console.log('🧪 Testing API Integrations...\n');

  try {
    // Test Weather API
    console.log('🌤️ Testing Weather API...');
    const weather = await FreeAPIService.getWeatherData();
    console.log('✅ Weather API:', weather ? 'Working' : 'Using mock data');
    if (weather) {
      console.log(`   Location: ${weather.location}, Temp: ${weather.temperature}°C`);
    }

    // Test News API
    console.log('\n📰 Testing News API...');
    const news = await FreeAPIService.getNewsData();
    console.log('✅ News API:', news && news.length > 0 ? 'Working' : 'Using mock data');
    if (news && news.length > 0) {
      console.log(`   Articles: ${news.length} headlines fetched`);
    }

    // Test Currency API
    console.log('\n💱 Testing Currency API...');
    const currency = await FreeAPIService.getCurrencyData();
    console.log('✅ Currency API:', currency ? 'Working' : 'Using mock data');
    if (currency) {
      console.log(`   Base: ${currency.base}, Rates: ${Object.keys(currency.rates).length} currencies`);
    }

    // Test System Info
    console.log('\n💻 Testing System Info...');
    const systemInfo = FreeAPIService.getSystemInfo();
    console.log('✅ System Info: Working');
    console.log(`   Platform: ${systemInfo.platform}`);
    console.log(`   Memory: ${systemInfo.totalMemory}GB total, ${systemInfo.freeMemory}GB free`);
    console.log(`   CPU: ${systemInfo.cpuCores} cores`);

    console.log('\n🎉 All API tests completed!');
    console.log('\n📝 Note: If any API shows "Using mock data",');
    console.log('   it means the API key is not configured or the service is unavailable.');
    console.log('   Check the API setup guide in docs/api-setup-guide.md');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAPIs(); 