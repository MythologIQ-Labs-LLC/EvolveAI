export const config = {
  // Google OAuth Configuration
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret_here',
    apiKey: process.env.GOOGLE_API_KEY || 'your_google_api_key_here',
    redirectUri: 'http://localhost:3000/auth/callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/calendar'
    ]
  },
  
  // AI Studio Configuration
  aiStudio: {
    apiKey: process.env.AI_STUDIO_API_KEY || 'your_ai_studio_api_key_here',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },
  
  // Application Configuration
  app: {
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    name: process.env.NEXT_PUBLIC_APP_NAME || 'EvolveAI'
  },
  
  // Free API Integrations
  freeAPIs: {
    // OpenWeatherMap (free tier)
    openWeather: {
      apiKey: process.env.OPENWEATHER_API_KEY || 'your_openweather_api_key_here',
      baseUrl: 'https://api.openweathermap.org/data/2.5'
    },
    
    // NewsAPI (free tier)
    newsAPI: {
      apiKey: process.env.NEWS_API_KEY || 'your_news_api_key_here',
      baseUrl: 'https://newsapi.org/v2'
    },
    
    // Currency API (free tier)
    currencyAPI: {
      apiKey: process.env.CURRENCY_API_KEY || 'your_currency_api_key_here',
      baseUrl: 'https://api.exchangerate-api.com/v4'
    }
  }
} 