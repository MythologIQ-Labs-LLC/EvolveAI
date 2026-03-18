import axios from 'axios';

export interface GoogleAPIConfig {
  apiKey?: string;
  accessToken?: string;
  projectId?: string;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data?: string };
    parts?: Array<{ body: { data?: string } }>;
  };
  internalDate: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
  webViewLink?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string; displayName?: string }>;
  location?: string;
}

export interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

export interface VisionAnalysis {
  labels: Array<{ description: string; confidence: number }>;
  text: string;
  faces: Array<{ confidence: number; boundingPoly: any }>;
  objects: Array<{ name: string; confidence: number }>;
}

export interface TranslationResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

export class GoogleAPIClient {
  private config: GoogleAPIConfig;

  constructor(config: GoogleAPIConfig) {
    this.config = config;
  }

  // Gmail API
  async getGmailMessages(maxResults: number = 10): Promise<GmailMessage[]> {
    try {
      const response = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          params: {
            maxResults,
            format: 'full',
          },
        }
      );
      return response.data.messages || [];
    } catch (error) {
      console.error('Gmail API Error:', error);
      throw new Error(`Gmail API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendGmailMessage(to: string, subject: string, body: string): Promise<boolean> {
    try {
      const message = this.createGmailMessage(to, subject, body);
      const response = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`,
        { raw: message },
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return !!response.data.id;
    } catch (error) {
      console.error('Gmail Send Error:', error);
      throw new Error(`Gmail Send Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createGmailMessage(to: string, subject: string, body: string): string {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');
    return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  // Google Drive API
  async getDriveFiles(maxResults: number = 10): Promise<DriveFile[]> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/drive/v3/files`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          params: {
            pageSize: maxResults,
            fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,parents,webViewLink)',
          },
        }
      );
      return response.data.files || [];
    } catch (error) {
      console.error('Drive API Error:', error);
      throw new Error(`Drive API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async uploadDriveFile(fileName: string, mimeType: string, content: string): Promise<DriveFile> {
    try {
      const response = await axios.post(
        `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`,
        this.createMultipartBody(fileName, mimeType, content),
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'multipart/related; boundary=foo_bar_baz',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Drive Upload Error:', error);
      throw new Error(`Drive Upload Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createMultipartBody(fileName: string, mimeType: string, content: string): string {
    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    const multipartBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n\r\n' +
      content +
      closeDelim;

    return multipartBody;
  }

  // Google Calendar API
  async getCalendarEvents(maxResults: number = 10): Promise<CalendarEvent[]> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          params: {
            maxResults,
            timeMin: new Date().toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
          },
        }
      );
      return response.data.items || [];
    } catch (error) {
      console.error('Calendar API Error:', error);
      throw new Error(`Calendar API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createCalendarEvent(event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    try {
      const response = await axios.post(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
        event,
        {
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Calendar Create Error:', error);
      throw new Error(`Calendar Create Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // YouTube Data API
  async searchYouTubeVideos(query: string, maxResults: number = 10): Promise<YouTubeVideo[]> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/search`,
        {
          params: {
            part: 'snippet',
            q: query,
            maxResults,
            type: 'video',
            key: this.config.apiKey,
          },
        }
      );
      return response.data.items || [];
    } catch (error) {
      console.error('YouTube API Error:', error);
      throw new Error(`YouTube API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getYouTubeVideoDetails(videoId: string): Promise<YouTubeVideo> {
    try {
      const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos`,
        {
          params: {
            part: 'snippet,statistics',
            id: videoId,
            key: this.config.apiKey,
          },
        }
      );
      return response.data.items[0];
    } catch (error) {
      console.error('YouTube Video Details Error:', error);
      throw new Error(`YouTube Video Details Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Google Cloud Vision API
  async analyzeImage(imageUrl: string): Promise<VisionAnalysis> {
    try {
      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.config.apiKey}`,
        {
          requests: [
            {
              image: {
                source: {
                  imageUri: imageUrl,
                },
              },
              features: [
                { type: 'LABEL_DETECTION', maxResults: 10 },
                { type: 'TEXT_DETECTION' },
                { type: 'FACE_DETECTION', maxResults: 10 },
                { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
              ],
            },
          ],
        }
      );

      const result = response.data.responses[0];
      return {
        labels: result.labelAnnotations?.map((label: any) => ({
          description: label.description,
          confidence: label.score,
        })) || [],
        text: result.fullTextAnnotation?.text || '',
        faces: result.faceAnnotations || [],
        objects: result.localizedObjectAnnotations?.map((obj: any) => ({
          name: obj.name,
          confidence: obj.score,
        })) || [],
      };
    } catch (error) {
      console.error('Vision API Error:', error);
      throw new Error(`Vision API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Google Cloud Translation API
  async translateText(text: string, targetLanguage: string, sourceLanguage?: string): Promise<TranslationResult> {
    try {
      const response = await axios.post(
        `https://translation.googleapis.com/language/translate/v2?key=${this.config.apiKey}`,
        {
          q: text,
          target: targetLanguage,
          source: sourceLanguage,
          format: 'text',
        }
      );

      const result = response.data.data.translations[0];
      return {
        translatedText: result.translatedText,
        detectedSourceLanguage: result.detectedSourceLanguage,
      };
    } catch (error) {
      console.error('Translation API Error:', error);
      throw new Error(`Translation API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Google Cloud Speech API
  async transcribeAudio(audioContent: string, languageCode: string = 'en-US'): Promise<string> {
    try {
      const response = await axios.post(
        `https://speech.googleapis.com/v1/speech:recognize?key=${this.config.apiKey}`,
        {
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: 16000,
            languageCode: languageCode,
          },
          audio: {
            content: audioContent,
          },
        }
      );

      return response.data.results
        ?.map((result: any) => result.alternatives[0].transcript)
        .join(' ') || '';
    } catch (error) {
      console.error('Speech API Error:', error);
      throw new Error(`Speech API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Google Cloud Natural Language API
  async analyzeSentiment(text: string): Promise<{ score: number; magnitude: number }> {
    try {
      const response = await axios.post(
        `https://language.googleapis.com/v1/documents:analyzeSentiment?key=${this.config.apiKey}`,
        {
          document: {
            type: 'PLAIN_TEXT',
            content: text,
          },
        }
      );

      const sentiment = response.data.documentSentiment;
      return {
        score: sentiment.score,
        magnitude: sentiment.magnitude,
      };
    } catch (error) {
      console.error('Natural Language API Error:', error);
      throw new Error(`Natural Language API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Google Places API
  async searchPlaces(query: string, location?: { lat: number; lng: number }): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json`,
        {
          params: {
            query,
            key: this.config.apiKey,
            ...(location && { location: `${location.lat},${location.lng}` }),
          },
        }
      );
      return response.data.results || [];
    } catch (error) {
      console.error('Places API Error:', error);
      throw new Error(`Places API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Test API connections
  async testAPIConnection(apiName: string): Promise<boolean> {
    try {
      switch (apiName) {
        case 'gmail':
          await this.getGmailMessages(1);
          return true;
        case 'drive':
          await this.getDriveFiles(1);
          return true;
        case 'calendar':
          await this.getCalendarEvents(1);
          return true;
        case 'youtube':
          await this.searchYouTubeVideos('test', 1);
          return true;
        case 'vision':
          // Test with a simple image URL
          await this.analyzeImage('https://via.placeholder.com/150');
          return true;
        case 'translation':
          await this.translateText('Hello', 'es');
          return true;
        default:
          return false;
      }
    } catch (error) {
      console.error(`${apiName} API Test Error:`, error);
      return false;
    }
  }

  // Get API usage and cost estimates
  getAPIUsage(): Record<string, { calls: number; cost: number }> {
    // This would track actual usage in a real implementation
    return {
      'gmail-api': { calls: 0, cost: 0 },
      'google-drive': { calls: 0, cost: 0 },
      'google-calendar': { calls: 0, cost: 0 },
      'youtube-api': { calls: 0, cost: 0 },
      'cloud-vision': { calls: 0, cost: 0 },
      'cloud-translation': { calls: 0, cost: 0 },
      'cloud-speech': { calls: 0, cost: 0 },
      'natural-language': { calls: 0, cost: 0 },
      'places-api': { calls: 0, cost: 0 },
    };
  }
} 