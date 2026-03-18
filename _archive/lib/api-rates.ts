import axios from 'axios';

export interface APIRate {
  apiName: string;
  displayName: string;
  category: string;
  pricing: {
    unit: string;
    cost: number;
    currency: string;
    freeTier?: {
      limit: number;
      unit: string;
    };
  };
  quota: {
    daily: number;
    monthly?: number;
    perMinute?: number;
  };
  lastUpdated: string;
  source: 'google-cloud' | 'cached' | 'estimated';
}

export interface APIRateCache {
  rates: APIRate[];
  lastFetched: string;
  nextUpdate: string;
  version: string;
}

class APIRateManager {
  private cache: APIRateCache | null = null;
  private readonly CACHE_KEY = 'evolveai-api-rates';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly FALLBACK_RATES: APIRate[] = [
    {
      apiName: 'gmail',
      displayName: 'Gmail API',
      category: 'workspace',
      pricing: {
        unit: '1000 requests',
        cost: 0.05,
        currency: 'USD',
        freeTier: { limit: 1000000, unit: 'requests' }
      },
      quota: { daily: 1000000, perMinute: 250 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'drive',
      displayName: 'Google Drive API',
      category: 'workspace',
      pricing: {
        unit: '1000 requests',
        cost: 0.04,
        currency: 'USD',
        freeTier: { limit: 1000000, unit: 'requests' }
      },
      quota: { daily: 1000000, perMinute: 1000 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'calendar',
      displayName: 'Google Calendar API',
      category: 'workspace',
      pricing: {
        unit: '1000 requests',
        cost: 0.03,
        currency: 'USD',
        freeTier: { limit: 1000000, unit: 'requests' }
      },
      quota: { daily: 1000000, perMinute: 1000 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'youtube',
      displayName: 'YouTube Data API',
      category: 'media',
      pricing: {
        unit: '100 units',
        cost: 0.01,
        currency: 'USD',
        freeTier: { limit: 10000, unit: 'units' }
      },
      quota: { daily: 10000, perMinute: 300 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'vision',
      displayName: 'Cloud Vision API',
      category: 'ai-ml',
      pricing: {
        unit: '1000 images',
        cost: 1.50,
        currency: 'USD',
        freeTier: { limit: 1000, unit: 'images' }
      },
      quota: { daily: 1000, perMinute: 1800 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'translation',
      displayName: 'Cloud Translation API',
      category: 'ai-ml',
      pricing: {
        unit: 'million characters',
        cost: 20.00,
        currency: 'USD',
        freeTier: { limit: 500000, unit: 'characters' }
      },
      quota: { daily: 500000, perMinute: 600 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'speech',
      displayName: 'Cloud Speech API',
      category: 'ai-ml',
      pricing: {
        unit: '15 seconds',
        cost: 0.006,
        currency: 'USD',
        freeTier: { limit: 60, unit: 'minutes' }
      },
      quota: { daily: 60, perMinute: 300 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'natural-language',
      displayName: 'Cloud Natural Language API',
      category: 'ai-ml',
      pricing: {
        unit: 'text record',
        cost: 0.001,
        currency: 'USD',
        freeTier: { limit: 5000, unit: 'records' }
      },
      quota: { daily: 5000, perMinute: 600 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    },
    {
      apiName: 'places',
      displayName: 'Places API',
      category: 'maps',
      pricing: {
        unit: 'request',
        cost: 0.017,
        currency: 'USD',
        freeTier: { limit: 100000, unit: 'requests' }
      },
      quota: { daily: 100000, perMinute: 1000 },
      lastUpdated: new Date().toISOString(),
      source: 'estimated'
    }
  ];

  constructor() {
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const cached = localStorage.getItem(this.CACHE_KEY);
        if (cached) {
          this.cache = JSON.parse(cached);
        }
      }
    } catch (error) {
      console.warn('Failed to load API rate cache:', error);
    }
  }

  private saveCache(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage && this.cache) {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache));
      }
    } catch (error) {
      console.warn('Failed to save API rate cache:', error);
    }
  }

  private isCacheValid(): boolean {
    if (!this.cache) return false;
    
    const now = new Date().getTime();
    const nextUpdate = new Date(this.cache.nextUpdate).getTime();
    
    return now < nextUpdate;
  }

  async fetchGoogleCloudRates(): Promise<APIRate[]> {
    try {
      // Note: Google Cloud doesn't provide a public API for pricing
      // In a real implementation, you might:
      // 1. Use Google Cloud Billing API (requires authentication)
      // 2. Scrape the pricing page (not recommended)
      // 3. Use a third-party pricing service
      // 4. Maintain a curated list with periodic updates

      // For now, we'll simulate fetching from a hypothetical pricing API
      const response = await axios.get('https://api.example.com/google-cloud-pricing', {
        timeout: 5000,
        headers: {
          'User-Agent': 'EvolveAI/1.0'
        }
      });

      return response.data.rates.map((rate: any) => ({
        ...rate,
        lastUpdated: new Date().toISOString(),
        source: 'google-cloud' as const
      }));
    } catch (error) {
      console.warn('Failed to fetch Google Cloud rates, using fallback:', error);
      return this.FALLBACK_RATES;
    }
  }

  async updateRates(): Promise<APIRate[]> {
    try {
      console.log('Fetching latest API rates...');
      
      const rates = await this.fetchGoogleCloudRates();
      
      this.cache = {
        rates,
        lastFetched: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + this.CACHE_DURATION).toISOString(),
        version: '1.0'
      };

      this.saveCache();
      console.log(`Updated ${rates.length} API rates`);
      
      return rates;
    } catch (error) {
      console.error('Failed to update API rates:', error);
      return this.getRates();
    }
  }

  getRates(): APIRate[] {
    if (this.isCacheValid() && this.cache) {
      return this.cache.rates;
    }
    
    // Return fallback rates if cache is invalid or missing
    return this.FALLBACK_RATES;
  }

  getRate(apiName: string): APIRate | undefined {
    return this.getRates().find(rate => rate.apiName === apiName);
  }

  getRatesByCategory(category: string): APIRate[] {
    return this.getRates().filter(rate => rate.category === category);
  }

  calculateCost(apiName: string, usage: number): number {
    const rate = this.getRate(apiName);
    if (!rate) return 0;

    const { unit, cost } = rate.pricing;
    
    // Handle different unit types
    if (unit.includes('1000 requests')) {
      return (usage / 1000) * cost;
    } else if (unit.includes('million characters')) {
      return (usage / 1000000) * cost;
    } else if (unit.includes('100 units')) {
      return (usage / 100) * cost;
    } else if (unit.includes('15 seconds')) {
      return (usage / 15) * cost;
    } else if (unit.includes('request')) {
      return usage * cost;
    } else if (unit.includes('images')) {
      return (usage / 1000) * cost;
    } else if (unit.includes('text record')) {
      return usage * cost;
    }

    return usage * cost;
  }

  getCacheInfo(): { lastFetched: string; nextUpdate: string; isValid: boolean } | null {
    if (!this.cache) return null;
    
    return {
      lastFetched: this.cache.lastFetched,
      nextUpdate: this.cache.nextUpdate,
      isValid: this.isCacheValid()
    };
  }

  async scheduleUpdate(): Promise<void> {
    // Schedule next update
    const now = Date.now();
    const nextUpdate = now + this.CACHE_DURATION;
    
    setTimeout(() => {
      this.updateRates();
    }, nextUpdate - now);
  }
}

// Singleton instance
export const apiRateManager = new APIRateManager();

// Auto-update on startup
if (typeof window !== 'undefined') {
  // Check if we need to update rates
  if (!apiRateManager.isCacheValid()) {
    apiRateManager.updateRates();
  }
  
  // Schedule periodic updates
  apiRateManager.scheduleUpdate();
} 