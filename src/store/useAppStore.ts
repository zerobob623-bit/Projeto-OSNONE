import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../firebase';

export type VoiceName = 'Charon' | 'Kore' | 'Puck' | 'Zephyr' | 'Fenrir';
export type Mood = 'happy' | 'calm' | 'focused' | 'playful' | 'melancholic' | 'angry' | 'singing';

export const VOICE_MAPPING: Record<VoiceName, string> = {
  'Charon': 'Charon',
  'Kore': 'Kore',
  'Puck': 'Puck',
  'Zephyr': 'Zephyr',
  'Fenrir': 'Fenrir'
};

export type OnboardingStep = 'initial' | 'boot' | 'active' | 'supernova' | 'completed';

export type PersonalityType = 'brother' | 'uncle' | 'best_friend' | 'partner' | 'father' | 'mother' | 'none';

export type MascotEyeStyle = 'normal' | 'happy' | 'cool' | 'wink' | 'heart';
export type MascotAction = 'idle' | 'pointing' | 'clicking';

export interface MascotAppearance {
  primaryColor: string;
  secondaryColor: string;
  eyeStyle: MascotEyeStyle;
}

export interface UserProfile {
  hobbies: string;
  relationships: string;
  lifestyle: 'homebody' | 'adventurous' | 'none';
  genderPreference: 'male' | 'female' | 'none';
  personality: PersonalityType;
  socialLevel: string;
  motherRelationship: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
}

export interface SystemMetrics {
  cpu: number;
  mem: number;
}

export interface TokenUsage {
  date: string;
  totalTokens: number;
  model: string;
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  icon: string;
  price?: number; // Price in "credits" or just a visual indicator
  category: 'tool' | 'skin' | 'personality';
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  enabled: boolean;
  icon: string;
  createdAt: string;
}

export const AVAILABLE_PLUGINS: Plugin[] = [
  { id: 'web_search', name: 'Web Search', description: 'Pesquisa na internet em tempo real.', installed: true, icon: '🌐', category: 'tool' },
  { id: 'image_gen', name: 'Image Generator', description: 'Gera imagens a partir de descrições.', installed: true, icon: '🎨', category: 'tool' },
  { id: 'self_evolution', name: 'Self Evolution', description: 'Permite que a IA leia e edite o próprio código.', installed: false, icon: '🧬', category: 'tool', price: 500 },
  { id: 'spotify_controller', name: 'Spotify Controller', description: 'Controla a reprodução do Spotify.', installed: false, icon: '🎵', category: 'tool', price: 200 },
  { id: 'calendar_sync', name: 'Calendar Sync', description: 'Sincroniza com o Google Calendar.', installed: false, icon: '📅', category: 'tool', price: 150 },
  { id: 'skin_neon', name: 'Neon Skin', description: 'Visual neon vibrante para o mascote.', installed: false, icon: '🌈', category: 'skin', price: 100 },
  { id: 'skin_gold', name: 'Gold Edition', description: 'Acabamento em ouro premium.', installed: false, icon: '✨', category: 'skin', price: 300 },
  { id: 'pers_sarcastic', name: 'Sarcastic Mode', description: 'Personalidade irônica e engraçada.', installed: false, icon: '😏', category: 'personality', price: 50 },
  { id: 'pers_zen', name: 'Zen Master', description: 'Respostas calmas e meditativas.', installed: false, icon: '🧘', category: 'personality', price: 50 },
];

interface AppState {
  // User
  user: User | null;
  setUser: (user: User | null) => void;
  userId: string | null;
  setUserId: (userId: string | null) => void;

  // Voice and Settings
  voice: VoiceName;
  setVoice: (voice: VoiceName) => void;
  mood: Mood;
  setMood: (mood: Mood) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  
  // Conversation History
  history: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearHistory: () => void;
  
  // System Metrics
  systemMetrics: SystemMetrics;
  setSystemMetrics: (metrics: SystemMetrics) => void;
  
  // Connection and Status
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
  isSpeaking: boolean;
  setIsSpeaking: (speaking: boolean) => void;
  isListening: boolean;
  setIsListening: (listening: boolean) => void;
  isThinking: boolean;
  setIsThinking: (thinking: boolean) => void;
  isScreenSharing: boolean;
  setIsScreenSharing: (sharing: boolean) => void;
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;
  
  // Mascot
  isMascotVisible: boolean;
  setIsMascotVisible: (visible: boolean) => void;
  mascotTarget: string | null;
  setMascotTarget: (target: string | null) => void;
  mascotAction: MascotAction;
  setMascotAction: (action: MascotAction) => void;
  mascotAppearance: MascotAppearance;
  setMascotAppearance: (appearance: Partial<MascotAppearance>) => void;
  
  // Onboarding
  onboardingStep: OnboardingStep;
  setOnboardingStep: (step: OnboardingStep) => void;
  userProfile: UserProfile;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  assistantName: string;
  setAssistantName: (name: string) => void;
  bootPhase: number;
  setBootPhase: (phase: number) => void;
  
  // Audio
  volume: number;
  setVolume: (volume: number) => void;
  
  // Error
  error: string | null;
  setError: (error: string | null) => void;
  
  // API Keys
  apiKey: string;
  setApiKey: (key: string) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  textModelProvider: 'groq' | 'openai';
  setTextModelProvider: (provider: 'groq' | 'openai') => void;

  // IMAP Config
  imapConfig: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
  } | null;
  setImapConfig: (config: any) => void;

  // Tokens
  tokenUsage: TokenUsage;
  addTokenUsage: (tokens: number, model: string) => void;

  // Plugins
  plugins: Plugin[];
  togglePlugin: (pluginId: string) => void;

  // Skills
  skills: Skill[];
  addSkill: (skill: Omit<Skill, 'id' | 'createdAt'>) => void;
  removeSkill: (skillId: string) => void;
  toggleSkill: (skillId: string) => void;

  // Task Status
  currentTask: string | null;
  setCurrentTask: (task: string | null) => void;

  // WhatsApp Integration
  whatsappStatus: 'disconnected' | 'connecting' | 'connected' | 'qr';
  setWhatsappStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'qr') => void;
  whatsappQr: string | null;
  setWhatsappQr: (qr: string | null) => void;

  // Alexa Integration
  alexaStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  setAlexaStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  alexaDevices: any[];
  setAlexaDevices: (devices: any[]) => void;

  // Reset
  resetSystem: () => void;

  // HIM Mode
  isHimMode: boolean;
  setIsHimMode: (isHim: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      user: null,
      setUser: (user) => set({ user }),
      userId: null,
      setUserId: (userId) => set({ userId }),

      // Voice and Settings
      voice: 'Kore',
      setVoice: (voice) => set({ voice }),
      mood: 'calm',
      setMood: (mood) => set({ mood }),
      isSettingsOpen: false,
      setIsSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
      isDarkMode: true,
      setIsDarkMode: (isDarkMode) => set({ isDarkMode }),
      
      // Conversation History
      history: [],
      addMessage: (message) => set((state) => ({ 
        history: [message, ...state.history].slice(0, 50) 
      })),
      clearHistory: () => set({ history: [] }),
      
      // System Metrics
      systemMetrics: { cpu: 0, mem: 0 },
      setSystemMetrics: (systemMetrics) => set({ systemMetrics }),
      
      // Connection and Status
      isConnected: false,
      setIsConnected: (isConnected) => set({ isConnected }),
      isSpeaking: false,
      setIsSpeaking: (isSpeaking) => set({ isSpeaking }),
      isListening: false,
      setIsListening: (isListening) => set({ isListening }),
      isThinking: false,
      setIsThinking: (isThinking) => set({ isThinking }),
      isScreenSharing: false,
      setIsScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
      focusMode: false,
      setFocusMode: (focusMode) => set({ focusMode }),
      
      // Mascot
      isMascotVisible: false,
      setIsMascotVisible: (isMascotVisible) => set({ isMascotVisible }),
      mascotTarget: null,
      setMascotTarget: (mascotTarget) => set({ mascotTarget }),
      mascotAction: 'idle',
      setMascotAction: (mascotAction) => set({ mascotAction }),
      mascotAppearance: {
        primaryColor: '#ff6b6b',
        secondaryColor: '#ffffff',
        eyeStyle: 'normal'
      },
      setMascotAppearance: (appearance) => set((state) => ({
        mascotAppearance: { ...state.mascotAppearance, ...appearance }
      })),
      
      // Onboarding
      onboardingStep: 'initial',
      setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
      userProfile: {
        hobbies: '',
        relationships: '',
        lifestyle: 'none',
        genderPreference: 'none',
        personality: 'none',
        socialLevel: '',
        motherRelationship: ''
      },
      setUserProfile: (profile) => set((state) => ({ 
        userProfile: { ...state.userProfile, ...profile } 
      })),
      assistantName: 'OSONE',
      setAssistantName: (assistantName) => set({ assistantName }),
      bootPhase: 0,
      setBootPhase: (bootPhase) => set({ bootPhase }),
      
      // Audio
      volume: 0,
      setVolume: (volume) => set({ volume }),
      
      // Error
      error: null,
      setError: (error) => set({ error }),

      // API Keys
      apiKey: '',
      setApiKey: (apiKey) => set({ apiKey }),
      groqApiKey: '',
      setGroqApiKey: (groqApiKey) => set({ groqApiKey }),
      openaiApiKey: '',
      setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
      textModelProvider: 'groq',
      setTextModelProvider: (textModelProvider) => set({ textModelProvider }),

      // IMAP Config
      imapConfig: null,
      setImapConfig: (imapConfig) => set({ imapConfig }),

      // Tokens
      tokenUsage: { date: new Date().toISOString().split('T')[0], totalTokens: 0, model: 'gemini-2.0-flash-exp' },
      addTokenUsage: (tokens, model) => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        if (state.tokenUsage.date !== today) {
          return { tokenUsage: { date: today, totalTokens: tokens, model } };
        }
        return { tokenUsage: { ...state.tokenUsage, totalTokens: state.tokenUsage.totalTokens + tokens, model } };
      }),

      // Plugins
      plugins: AVAILABLE_PLUGINS,
      togglePlugin: (pluginId) => set((state) => ({
        plugins: state.plugins.map(p => p.id === pluginId ? { ...p, installed: !p.installed } : p)
      })),

      // Skills
      skills: [],
      addSkill: (skill) => set((state) => ({
        skills: [...state.skills, { 
          ...skill, 
          id: Math.random().toString(36).substring(7), 
          createdAt: new Date().toISOString() 
        }]
      })),
      removeSkill: (skillId) => set((state) => ({
        skills: state.skills.filter(s => s.id !== skillId)
      })),
      toggleSkill: (skillId) => set((state) => ({
        skills: state.skills.map(s => s.id === skillId ? { ...s, enabled: !s.enabled } : s)
      })),

      // Task Status
      currentTask: null,
      setCurrentTask: (currentTask) => set({ currentTask }),

      // WhatsApp Integration
      whatsappStatus: 'disconnected',
      setWhatsappStatus: (whatsappStatus) => set({ whatsappStatus }),
      whatsappQr: null,
      setWhatsappQr: (whatsappQr) => set({ whatsappQr }),

      // Alexa Integration
      alexaStatus: 'disconnected',
      setAlexaStatus: (alexaStatus) => set({ alexaStatus }),
      alexaDevices: [],
      setAlexaDevices: (alexaDevices) => set({ alexaDevices }),

      // Reset System
      resetSystem: () => set({
        onboardingStep: 'initial',
        history: [],
        userProfile: {
          hobbies: '',
          relationships: '',
          lifestyle: 'none',
          genderPreference: 'none',
          personality: 'none',
          socialLevel: '',
          motherRelationship: ''
        },
        assistantName: 'OSONE',
        mood: 'calm',
        isConnected: false,
        isMascotVisible: false,
        isScreenSharing: false,
        focusMode: false,
        bootPhase: 0
      }),

      // HIM Mode
      isHimMode: false,
      setIsHimMode: (isHimMode) => set({ isHimMode }),
    }),
    {
      name: 'her-os-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields
      partialize: (state) => ({ 
        voice: state.voice, 
        systemMetrics: state.systemMetrics,
        onboardingStep: state.onboardingStep,
        userProfile: state.userProfile,
        assistantName: state.assistantName,
        isMascotVisible: state.isMascotVisible,
        mascotAppearance: state.mascotAppearance,
        apiKey: state.apiKey,
        groqApiKey: state.groqApiKey,
        openaiApiKey: state.openaiApiKey,
        textModelProvider: state.textModelProvider,
        imapConfig: state.imapConfig,
        focusMode: state.focusMode,
        mood: state.mood,
        tokenUsage: state.tokenUsage,
        plugins: state.plugins,
        skills: state.skills,
        isHimMode: state.isHimMode,
        isDarkMode: state.isDarkMode
      }),
    }
  )
);
