import { config } from './config';

export interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  location: string;
}

export interface NewsData {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
}

export interface CurrencyData {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

export class FreeAPIService {
  // Weather API (OpenWeatherMap - free tier)
  static async getWeatherData(city: string = 'London'): Promise<WeatherData | null> {
    try {
      const response = await fetch(
        `${config.freeAPIs.openWeather.baseUrl}/weather?q=${city}&appid=${config.freeAPIs.openWeather.apiKey}&units=metric`
      );
      
      if (!response.ok) {
        console.warn('Weather API not available, using mock data');
        return this.getMockWeatherData();
      }
      
      const data = await response.json();
      return {
        temperature: Math.round(data.main.temp),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        location: data.name
      };
    } catch (error) {
      console.warn('Weather API error, using mock data:', error);
      return this.getMockWeatherData();
    }
  }

  // News API (NewsAPI - free tier)
  static async getNewsData(category: string = 'technology'): Promise<NewsData[]> {
    try {
      const response = await fetch(
        `${config.freeAPIs.newsAPI.baseUrl}/top-headlines?country=us&category=${category}&apiKey=${config.freeAPIs.newsAPI.apiKey}&pageSize=5`
      );
      
      if (!response.ok) {
        console.warn('News API not available, using mock data');
        return this.getMockNewsData();
      }
      
      const data = await response.json();
      return data.articles.map((article: any) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        publishedAt: article.publishedAt,
        source: article.source.name
      }));
    } catch (error) {
      console.warn('News API error, using mock data:', error);
      return this.getMockNewsData();
    }
  }

  // Currency API (ExchangeRate-API - free tier)
  static async getCurrencyData(base: string = 'USD'): Promise<CurrencyData | null> {
    try {
      const response = await fetch(
        `${config.freeAPIs.currencyAPI.baseUrl}/latest/${base}`
      );
      
      if (!response.ok) {
        console.warn('Currency API not available, using mock data');
        return this.getMockCurrencyData();
      }
      
      const data = await response.json();
      return {
        base: data.base,
        rates: data.rates,
        timestamp: data.time_last_updated
      };
    } catch (error) {
      console.warn('Currency API error, using mock data:', error);
      return this.getMockCurrencyData();
    }
  }

  // System Information (real data)
  static getSystemInfo() {
    const os = require('os');
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)), // GB
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)), // GB
      cpuCores: os.cpus().length,
      uptime: Math.round(os.uptime() / 3600), // Hours
      loadAverage: os.loadavg()[0]
    };
  }

  // Mock data for when APIs are not available
  private static getMockWeatherData(): WeatherData {
    return {
      temperature: 22,
      description: 'Partly cloudy',
      humidity: 65,
      windSpeed: 12,
      location: 'London'
    };
  }

  private static getMockNewsData(): NewsData[] {
    return [
      {
        title: 'AI Breakthrough in Natural Language Processing',
        description: 'Researchers develop new model that improves language understanding by 40%',
        url: 'https://example.com/ai-breakthrough',
        publishedAt: new Date().toISOString(),
        source: 'Tech News'
      },
      {
        title: 'Quantum Computing Milestone Achieved',
        description: 'Scientists successfully demonstrate quantum supremacy in practical applications',
        url: 'https://example.com/quantum-milestone',
        publishedAt: new Date().toISOString(),
        source: 'Science Daily'
      },
      {
        title: 'Sustainable Energy Solutions Gain Momentum',
        description: 'Global investment in renewable energy reaches record levels',
        url: 'https://example.com/sustainable-energy',
        publishedAt: new Date().toISOString(),
        source: 'Green Tech'
      }
    ];
  }

  private static getMockCurrencyData(): CurrencyData {
    return {
      base: 'USD',
      rates: {
        EUR: 0.85,
        GBP: 0.73,
        JPY: 110.5,
        CAD: 1.25,
        AUD: 1.35
      },
      timestamp: Date.now()
    };
  }
} 