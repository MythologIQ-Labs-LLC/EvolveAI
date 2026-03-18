# API Setup Guide for EvolveAI

This guide will help you set up free API keys to enable live data in your EvolveAI dashboard.

## 🌤️ Weather API (OpenWeatherMap)

**Free Tier:** 1,000 calls/day

1. Go to [OpenWeatherMap](https://openweathermap.org/api)
2. Sign up for a free account
3. Navigate to "API keys" section
4. Copy your API key
5. Add to your environment variables:
   ```
   OPENWEATHER_API_KEY=your_api_key_here
   ```

## 📰 News API (NewsAPI)

**Free Tier:** 1,000 requests/day

1. Go to [NewsAPI](https://newsapi.org/)
2. Sign up for a free account
3. Copy your API key
4. Add to your environment variables:
   ```
   NEWS_API_KEY=your_api_key_here
   ```

## 💱 Currency API (ExchangeRate-API)

**Free Tier:** 1,500 requests/month

1. Go to [ExchangeRate-API](https://exchangerate-api.com/)
2. Sign up for a free account
3. Copy your API key
4. Add to your environment variables:
   ```
   CURRENCY_API_KEY=your_api_key_here
   ```

## 🤖 Google AI Studio

**Free Tier:** 60 requests/minute

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Create a new API key
4. Add to your environment variables:
   ```
   AI_STUDIO_API_KEY=your_api_key_here
   ```

## 🔐 Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the APIs you need:
   - Gmail API
   - Google Drive API
   - Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Set application type to "Web application"
6. Add authorized redirect URI: `http://localhost:3000/auth/callback`
7. Copy Client ID and Client Secret
8. Add to your environment variables:
   ```
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   ```

## 🚀 Quick Start

1. Create a `.env.local` file in your project root
2. Add your API keys:
   ```env
   # Weather API
   OPENWEATHER_API_KEY=your_openweather_api_key
   
   # News API
   NEWS_API_KEY=your_news_api_key
   
   # Currency API
   CURRENCY_API_KEY=your_currency_api_key
   
   # AI Studio
   AI_STUDIO_API_KEY=your_ai_studio_api_key
   
   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

## 📊 Dashboard Features

With these APIs configured, your dashboard will show:

- **Real-time weather data** from your location
- **Latest news headlines** from technology and science
- **Live currency exchange rates**
- **System performance metrics**
- **API connection status**
- **Real-time activity graphs**

## 🔧 Troubleshooting

### API Limits
- Weather API: 1,000 calls/day
- News API: 1,000 requests/day
- Currency API: 1,500 requests/month
- AI Studio: 60 requests/minute

### Fallback Behavior
If any API is unavailable or rate-limited, the dashboard will automatically use realistic mock data to ensure functionality.

### Environment Variables
Make sure your `.env.local` file is in the project root and not committed to version control.

## 📈 Monitoring

The dashboard includes built-in monitoring for:
- API response times
- Connection status
- Error rates
- Usage statistics

All data is updated in real-time and provides a comprehensive view of your EvolveAI system's performance. 