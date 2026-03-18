// Voice Interaction System for EvolveAI
// Supports local TTS, Google Cloud TTS, and voice recognition

export interface VoiceConfig {
  enabled: boolean;
  provider: 'local' | 'google' | 'azure';
  language: string;
  speed: number;
  volume: number;
  wakeWord: string;
  sensitivity: number;
  autoListenMode: 'manual' | 'wake-word' | 'continuous';
}

export interface VoiceRecognitionResult {
  text: string;
  confidence: number;
  isWakeWord: boolean;
  timestamp: Date;
}

export interface VoiceSynthesisResult {
  success: boolean;
  error?: string;
  duration?: number;
}

export class VoiceSystem {
  private config: VoiceConfig;
  private recognition: any; // SpeechRecognition
  private synthesis: SpeechSynthesis;
  private isListening: boolean = false;
  private wakeWordDetected: boolean = false;
  private onSpeechCallback?: (result: VoiceRecognitionResult) => void;
  private onWakeWordCallback?: () => void;

  constructor(config: VoiceConfig) {
    this.config = config;
    this.synthesis = window.speechSynthesis;
    this.initializeRecognition();
  }

  private initializeRecognition() {
    // Initialize speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = this.config.language;
      
      this.recognition.onstart = () => {
        this.isListening = true;
        console.log('Voice recognition started');
      };
      
      this.recognition.onend = () => {
        this.isListening = false;
        console.log('Voice recognition ended');
        
        // Restart if in continuous mode
        if (this.config.autoListenMode === 'continuous' && this.config.enabled) {
          this.startListening();
        }
      };
      
      this.recognition.onresult = (event: any) => {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim();
        const confidence = result[0].confidence;
        
        if (result.isFinal) {
          this.processSpeech(transcript, confidence);
        }
      };
      
      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        this.isListening = false;
      };
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  private processSpeech(transcript: string, confidence: number) {
    const isWakeWord = this.detectWakeWord(transcript);
    const timestamp = new Date();
    
    const result: VoiceRecognitionResult = {
      text: transcript,
      confidence,
      isWakeWord,
      timestamp
    };
    
    if (isWakeWord) {
      this.wakeWordDetected = true;
      this.onWakeWordCallback?.();
      console.log('Wake word detected:', this.config.wakeWord);
    } else if (this.wakeWordDetected || this.config.autoListenMode === 'continuous') {
      this.onSpeechCallback?.(result);
    }
  }

  private detectWakeWord(transcript: string): boolean {
    const wakeWordLower = this.config.wakeWord.toLowerCase();
    const transcriptLower = transcript.toLowerCase();
    
    // Check if wake word is in the transcript
    if (transcriptLower.includes(wakeWordLower)) {
      return true;
    }
    
    // Fuzzy matching for wake word detection
    const similarity = this.calculateSimilarity(transcriptLower, wakeWordLower);
    return similarity >= this.config.sensitivity;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }

  // Public methods
  public startListening(): void {
    if (!this.config.enabled || !this.recognition) {
      return;
    }
    
    try {
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start voice recognition:', error);
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      this.wakeWordDetected = false;
    }
  }

  public async speak(text: string): Promise<VoiceSynthesisResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Voice synthesis is disabled' };
    }

    return new Promise((resolve) => {
      try {
        if (this.config.provider === 'local') {
          this.speakLocal(text, resolve);
        } else if (this.config.provider === 'google') {
          this.speakGoogle(text, resolve);
        } else if (this.config.provider === 'azure') {
          this.speakAzure(text, resolve);
        } else {
          resolve({ success: false, error: 'Unknown voice provider' });
        }
      } catch (error) {
        resolve({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  private speakLocal(text: string, resolve: (result: VoiceSynthesisResult) => void): void {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.config.language;
    utterance.rate = this.config.speed;
    utterance.volume = this.config.volume;
    
    const startTime = Date.now();
    
    utterance.onend = () => {
      const duration = Date.now() - startTime;
      resolve({ success: true, duration });
    };
    
    utterance.onerror = (event) => {
      resolve({ success: false, error: `Speech synthesis error: ${event.error}` });
    };
    
    this.synthesis.speak(utterance);
  }

  private async speakGoogle(text: string, resolve: (result: VoiceSynthesisResult) => void): Promise<void> {
    try {
      // This would integrate with Google Cloud TTS API
      // For now, fall back to local synthesis
      console.log('Google Cloud TTS not implemented, using local synthesis');
      this.speakLocal(text, resolve);
    } catch (error) {
      resolve({ success: false, error: 'Google Cloud TTS failed' });
    }
  }

  private async speakAzure(text: string, resolve: (result: VoiceSynthesisResult) => void): Promise<void> {
    try {
      // This would integrate with Azure Speech Services
      // For now, fall back to local synthesis
      console.log('Azure Speech Services not implemented, using local synthesis');
      this.speakLocal(text, resolve);
    } catch (error) {
      resolve({ success: false, error: 'Azure Speech Services failed' });
    }
  }

  public onSpeech(callback: (result: VoiceRecognitionResult) => void): void {
    this.onSpeechCallback = callback;
  }

  public onWakeWord(callback: () => void): void {
    this.onWakeWordCallback = callback;
  }

  public updateConfig(newConfig: Partial<VoiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.recognition) {
      this.recognition.lang = this.config.language;
    }
  }

  public getConfig(): VoiceConfig {
    return { ...this.config };
  }

  public isListening(): boolean {
    return this.isListening;
  }

  public stop(): void {
    this.stopListening();
    this.synthesis.cancel();
  }
}

// Voice System Manager for coordinating multiple voice instances
export class VoiceSystemManager {
  private voiceSystems: Map<string, VoiceSystem> = new Map();
  private defaultConfig: VoiceConfig = {
    enabled: false,
    provider: 'local',
    language: 'en-US',
    speed: 1.0,
    volume: 0.8,
    wakeWord: 'Hey Evolve',
    sensitivity: 0.7,
    autoListenMode: 'manual'
  };

  public createVoiceSystem(id: string, config?: Partial<VoiceConfig>): VoiceSystem {
    const fullConfig = { ...this.defaultConfig, ...config };
    const voiceSystem = new VoiceSystem(fullConfig);
    this.voiceSystems.set(id, voiceSystem);
    return voiceSystem;
  }

  public getVoiceSystem(id: string): VoiceSystem | undefined {
    return this.voiceSystems.get(id);
  }

  public removeVoiceSystem(id: string): void {
    const voiceSystem = this.voiceSystems.get(id);
    if (voiceSystem) {
      voiceSystem.stop();
      this.voiceSystems.delete(id);
    }
  }

  public stopAll(): void {
    this.voiceSystems.forEach(voiceSystem => voiceSystem.stop());
  }

  public updateDefaultConfig(config: Partial<VoiceConfig>): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}

// Export singleton instance
export const voiceManager = new VoiceSystemManager(); 