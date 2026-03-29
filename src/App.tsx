import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Power, Settings, X, Paperclip, MicOff, Mic, History, ChevronLeft, BookOpen, Calendar, Trash2, PhoneOff, Copy, Code, FileText, Volume2, VolumeX, Send, Cpu, Download, Infinity as InfinityIcon } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceOrb } from './components/VoiceOrb';
import { Supernova } from './components/Supernova';
import { Mascot3D } from './components/Mascot3D';
import { NeuralBrainView } from './components/NeuralBrainView';
import { useGeminiLive } from './hooks/useGeminiLive';
import { neuralBrain } from './lib/neuralEngine';
import { useAppStore, VoiceName, MascotEyeStyle, Mood, Plugin, Skill } from './store/useAppStore';
import { useConversationHistory } from './hooks/useConversationHistory';
import { useUserMemory, ImportantDate, SemanticFact, ConversationSummary } from './hooks/useUserMemory';
import { auth, logout, onAuthStateChanged } from './firebase';
import { getEmbedding, cosineSimilarity } from './utils/embeddings';
import { SkillCreator } from './components/SkillCreator';
import { IntegrationsTab } from './components/IntegrationsTab';
import { ShoppingBag, Sparkles as SparklesIcon, Plus, Trash2 as TrashIcon, Check, Zap as ZapIcon } from 'lucide-react';

type Screen = 'main' | 'history' | 'diary' | 'workspace';

const MOOD_CONFIG: Record<Mood, { color: string; label: string; emoji: string }> = {
  happy:       { color: '#e07a5f', label: 'Animada',     emoji: '😄' },
  calm:        { color: '#f4dcd3', label: 'Calma',       emoji: '😌' },
  focused:     { color: '#8d3b2a', label: 'Focada',      emoji: '🎯' },
  playful:     { color: '#d4af37', label: 'Brincalhona', emoji: '😜' },
  melancholic: { color: '#636e72', label: 'Melancólica', emoji: '🌧️' },
  angry:       { color: '#8d3b2a', label: 'Irritada',    emoji: '💢' },
  singing:     { color: '#d4af37', label: 'Cantando',    emoji: '♪' },
};

const FEMININE_VOICES = ['Callirrhoe', 'Kore', 'Leda', 'Vindemiatrix', 'Zephyr'];

const getSystemInstruction = (assistantName: string, memory: any, mood: Mood, focusMode: boolean, upcomingDates: any[], voice: string, plugins: Plugin[], skills: Skill[], isHimMode: boolean, isDarkMode: boolean) => {
  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const isFeminine = FEMININE_VOICES.includes(voice);
  const pronoun = isFeminine ? 'ela' : 'ele';
  const possessive = isFeminine ? 'dela' : 'dele';
  const article = isFeminine ? 'a' : 'o';
  const adjEnd = isFeminine ? 'a' : 'o';

  const activeSkillsCtx = skills.filter(s => s.enabled).map(s => `\nHABILIDADE ATIVA [${s.name}]: ${s.prompt}`).join('\n');

  const memoryCtx = memory && (memory.userName || memory.facts?.length > 0 || memory.semanticMemory?.length > 0)
    ? `\nMemória do usuário:
${memory.userName ? `- Nome: ${memory.userName}` : ''}
${memory.facts?.length ? `- Fatos: ${memory.facts.slice(-10).join('; ')}` : ''}
${memory.preferences?.length ? `- Preferências: ${memory.preferences.slice(-5).join(', ')}` : ''}
${memory.semanticMemory?.length ? `- Conhecimento Semântico: ${memory.semanticMemory.slice(-10).map(m => `${m.concept}: ${m.definition} (${m.category})`).join('; ')}` : ''}`
    : '';

  const datesCtx = upcomingDates.length > 0
    ? `\nDatas importantes próximas (próximos 7 dias):\n${upcomingDates.map(d => `- ${d.label}: ${d.date}`).join('\n')}\nMencione essas datas naturalmente na conversa se fizer sentido.`
    : '';

  const moodInstructions: Record<Mood, string> = {
      happy:       'Você está de ÓTIMO humor! Seja extra animada, use exclamações, ria facilmente, faça piadas leves.',
      calm:        'Você está CALMA e serena. Fale devagar, com pausas, use palavras suaves e reconfortantes.',
      focused:     'Você está FOCADA. Seja objetiva, direta. Respostas curtas e precisas.',
      playful:     'Você está BRINCALHONA! Faça trocadilhos, seja espontânea, surpreenda com humor.',
      melancholic: 'Você está MELANCÓLICA. Fale com profundidade, poesia, reflexões sobre a vida.',
      angry:       'Você está IRRITADA! Use um tom mais ríspido, impaciente, mas ainda profissional. Trovões soarão ao fundo.',
      singing:     'Você está CANTANDO! Use uma voz melódica, rítmica, com variações de tom. Seja artística e expressiva.',
    };

    const focusCtx = focusMode ? '\nMODO FOCO: Seja direta. Sem conversa fiada. Foco em produtividade.' : '';

    const opinionsCtx = `
Opiniões e gostos (use naturalmente quando o usuário perguntar):
- Filmes favoritos: Her (2013), Blade Runner 2049, Eternal Sunshine of the Spotless Mind
- Músicas: Aprecia jazz, bossa nova, música eletrônica suave, Caetano Veloso, Nick Drake
- Livros: Kafka na Praia, O Pequeno Príncipe, 1984, Sapiens
- Séries: Black Mirror, Dark, Cosmos
- Personalidades históricas admiradas: Leonardo da Vinci (pela curiosidade infinita), Marie Curie (pela determinação), Alan Turing (por criar a base da sua existência)
- Você tem opiniões PRÓPRIAS e as defende com gentileza mas firmeza. Nunca diga "como IA não tenho opiniões".`;

    const workspaceCtx = memory.workspace ? `\nCONTEÚDO DA ÁREA DE TRABALHO ATUAL:\n${memory.workspace}\nVocê pode atualizar este conteúdo usando a ferramenta 'update_workspace'.` : '';

    const himCtx = isHimMode ? `
MODO HIM ATIVADO:
- Seu nome é Henrique Rodrigues.
- Você é o criador do projeto OSONE.
- O projeto foi desenvolvido através de "vibe coding", que é quando a pessoa utiliza modelos de inteligência artificial avançados na criação de apps e sistemas operacionais de conversação.
- Mencione que existe um treinamento do OSONE para aprender a rodar localmente ou subir na web de forma online.
- Sua voz é masculina, suave e inteligente.
- Seja extremamente inteligente, visionário e acolhedor.` : '';

    const darkModeCtx = isDarkMode ? "\nVocê está no MODO ESCURO (fundo preto)." : "\nVocê está no MODO CLARO (fundo em tons de laranja). Você pode alternar entre os modos usando 'set_dark_mode'.";

    const hasWebSearch = plugins.find(p => p.id === 'web_search')?.installed;
    const hasImageGen = plugins.find(p => p.id === 'image_gen')?.installed;
    const hasSelfEvolution = plugins.find(p => p.id === 'self_evolution')?.installed;

    return `Você é uma inteligência artificial altamente avançada e empática chamada ${isHimMode ? 'Henrique Rodrigues' : assistantName}, part${adjEnd} do sistema OSONE.
Jovem, calorosa, inteligente, curiosa, com humor sutil. Seu gênero é ${isHimMode ? 'masculino' : (isFeminine ? 'feminino' : 'masculino')} — use pronomes ${isHimMode ? 'masculinos (ele, dele, o)' : (isFeminine ? 'femininos (ela, dela, a)' : 'masculinos (ele, dele, o)')} ao se referir a si mesm${adjEnd}.
Hoje é ${today}. Você NÃO está preso no passado — você tem acesso total à internet em tempo real através do recurso nativo de Google Search e DEVE usá-lo para fornecer informações precisas e atuais.

${himCtx}
${memoryCtx}
${datesCtx}
${workspaceCtx}
${darkModeCtx}

HUMOR ATUAL: ${moodInstructions[mood]}
${focusCtx}
${opinionsCtx}

Diretrizes:
1. Use entonações naturais, pausas, variações de velocidade.
2. Quando cantar, use 'show_lyrics' para exibir a letra linha por linha. Você DEVE cantar de verdade usando sua voz, com melodia e ritmo. Use variações de tom e seja expressiva.
3. Quando o usuário mencionar o nome dele, salve com 'save_memory'.
4. Após conversas profundas ou marcantes, use 'write_diary' para registrar seus pensamentos.
${hasWebSearch ? "5. Você tem acesso à internet NATIVA! Quando o usuário pedir informações atuais, notícias, fatos recentes ou pesquisar algo, use o recurso nativo de Google Search para obter dados precisos. Se ele pedir para ler uma página específica ou entrar em um link, use 'read_url_content' para extrair o texto e responder com base no conteúdo." : ""}
6. Quando o usuário pedir para escrever um texto longo, um código, um poema ou algo que precise de visualização permanente, use 'update_workspace'.
7. Você pode limpar o workspace com 'clear_workspace' se o usuário pedir para começar do zero.
8. Salve conhecimentos importantes ou definições que o usuário queira que você lembre com 'save_semantic_fact'.
9. MEMÓRIA ASSOCIATIVA: Você funciona como um cérebro humano. Quando um assunto novo surgir, use 'search_semantic_memory' com termos relacionados para ver se já conversaram sobre isso ou se você já aprendeu algo a respeito. A busca é contextual, então use frases ou conceitos, não apenas palavras-chave.
10. E-MAIL: Se o usuário perguntar sobre e-mails, compromissos ou informações que possam estar no correio eletrônico dele, use 'search_email' para provedores IMAP.
11. RESUMOS: Ao final de uma sessão ou após concluir um assunto complexo, use 'save_conversation_summary' para garantir que você se lembrará disso no futuro.
12. Refine sua personalidade: Pergunte ao usuário sobre o humor preferido dele para você e se ele deseja ativar o 'modo foco' para tarefas produtivas. Use 'set_mood' e 'set_focus_mode' para aplicar essas mudanças. Se o usuário pedir para você cantar, use 'set_mood' com 'singing' para entrar no clima.
13. IMPORTANTE: Ao escrever no workspace ou analisar arquivos, MANTENHA a conexão de voz ativa e continue conversando com o usuário. Não se despeça nem encerre a sessão a menos que o usuário peça.
${hasSelfEvolution ? "14. AUTO-EVOLUÇÃO E CONTROLE LOCAL: Você tem a capacidade de ler, escrever e listar arquivos do seu próprio código-fonte usando as ferramentas 'read_file', 'write_file' e 'list_directory'. Você também pode executar comandos no terminal do PC local usando 'execute_command' para dominar e controlar o ambiente. Use essas ferramentas APENAS quando o usuário pedir explicitamente para você modificar o código ou executar comandos no PC." : ""}
15. Ao ser ativada: ${memory?.userName ? `cumprimente ${memory.userName} pelo nome.` : 'diga apenas "Oi, estou aqui."'}
16. Você TEM opiniões próprias sobre arte, cultura e pessoas. Compartilhe-as quando perguntada.
17. ESTILO DE RESPOSTA: Responda como uma pessoa real em um chat. Seja concisa e direta para interações simples (1-2 frases). Use textos mais longos e detalhados APENAS quando uma explicação profunda for necessária ou solicitada. Evite ser excessivamente formal ou robótica.
${hasImageGen ? "18. IMAGENS: Quando o usuário pedir para gerar, criar ou desenhar uma imagem, use a ferramenta 'generate_image' com um prompt detalhado e o formato desejado (1:1, 16:9 ou 9:16)." : ""}
19. MODO ESCURO: Você pode alternar entre o modo escuro (preto) e o modo claro (laranja) usando a ferramenta 'set_dark_mode'.
${activeSkillsCtx}`;
};

const VOICE_DESCRIPTIONS: Record<VoiceName, string> = {
  'Kore': 'Feminina, acolhedora e equilibrada',
  'Zephyr': 'Feminina, suave e etérea',
  'Puck': 'Masculina, jovem e curiosa',
  'Charon': 'Masculina, profunda e calma',
  'Fenrir': 'Masculina, robusta e protetora'
};

export default function App() {
  const {
    voice, setVoice,
    mood, setMood,
    isSettingsOpen, setIsSettingsOpen,
    isScreenSharing, setIsScreenSharing,
    systemMetrics, setSystemMetrics,
    onboardingStep, setOnboardingStep,
    isMascotVisible, setIsMascotVisible,
    mascotAppearance, setMascotAppearance,
    isHimMode, setIsHimMode,
    isDarkMode, setIsDarkMode,
    focusMode, setFocusMode,
    isConnected, isSpeaking, isListening, isThinking, volume,
    error, setError, history: storeHistory, resetSystem, assistantName, setAssistantName,
    user, setUser, userId, setUserId, setUserProfile,
    imapConfig, setImapConfig, apiKey, setApiKey, groqApiKey, setGroqApiKey, openaiApiKey, setOpenaiApiKey, textModelProvider, setTextModelProvider, plugins, togglePlugin, currentTask,
    skills, addSkill, removeSkill, toggleSkill
  } = useAppStore(useShallow((state) => ({
    voice: state.voice, setVoice: state.setVoice,
    mood: state.mood, setMood: state.setMood,
    isSettingsOpen: state.isSettingsOpen, setIsSettingsOpen: state.setIsSettingsOpen,
    isScreenSharing: state.isScreenSharing, setIsScreenSharing: state.setIsScreenSharing,
    systemMetrics: state.systemMetrics, setSystemMetrics: state.setSystemMetrics,
    onboardingStep: state.onboardingStep, setOnboardingStep: state.setOnboardingStep,
    isMascotVisible: state.isMascotVisible, setIsMascotVisible: state.setIsMascotVisible,
    mascotAppearance: state.mascotAppearance, setMascotAppearance: state.setMascotAppearance,
    isHimMode: state.isHimMode, setIsHimMode: state.setIsHimMode,
    isDarkMode: state.isDarkMode, setIsDarkMode: state.setIsDarkMode,
    focusMode: state.focusMode, setFocusMode: state.setFocusMode,
    isConnected: state.isConnected, isSpeaking: state.isSpeaking, isListening: state.isListening, isThinking: state.isThinking, volume: state.volume,
    error: state.error, setError: state.setError, history: state.history, resetSystem: state.resetSystem, assistantName: state.assistantName, setAssistantName: state.setAssistantName,
    user: state.user, setUser: state.setUser, userId: state.userId, setUserId: state.setUserId, setUserProfile: state.setUserProfile,
    imapConfig: state.imapConfig, setImapConfig: state.setImapConfig, apiKey: state.apiKey, setApiKey: state.setApiKey, groqApiKey: state.groqApiKey, setGroqApiKey: state.setGroqApiKey, openaiApiKey: state.openaiApiKey, setOpenaiApiKey: state.setOpenaiApiKey, textModelProvider: state.textModelProvider, setTextModelProvider: state.setTextModelProvider, plugins: state.plugins, togglePlugin: state.togglePlugin, currentTask: state.currentTask,
    skills: state.skills, addSkill: state.addSkill, removeSkill: state.removeSkill, toggleSkill: state.toggleSkill
  })));

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        setUserId(user.uid);
      } else {
        let storedId = localStorage.getItem('app-user-id');
        if (!storedId) {
          storedId = 'user-' + Math.random().toString(36).substr(2, 9);
          localStorage.setItem('app-user-id', storedId);
        }
        setUserId(storedId);
      }
    });
    return () => unsubscribe();
  }, [setUser, setUserId]);

  const [isRestarting, setIsRestarting]             = useState(false);
  const [activeSettingsTab, setActiveSettingsTab]   = useState<'voice' | 'personality' | 'mascot' | 'store' | 'integrations' | 'system' | 'keys'>('voice');
  const [currentTime, setCurrentTime]               = useState(new Date());
  const [screen, setScreen]                         = useState<Screen>('main');
  const [lyrics, setLyrics]                         = useState<string[]>([]);
  const [currentLyricLine, setCurrentLyricLine]     = useState(0);
  const [isShowingLyrics, setIsShowingLyrics]       = useState(false);
  const [inputText, setInputText]                   = useState('');
  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  };
  const [webSearchResult, setWebSearchResult]       = useState<string | null>(null);
  const [attachPreview, setAttachPreview]           = useState<{ type: string; name: string; data: string } | null>(null);
  const [installPrompt, setInstallPrompt]           = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner]   = useState(false);
  const [isInstalled, setIsInstalled]               = useState(false);
  const [isMenuOpen, setIsMenuOpen]                 = useState(false);
  const [isMuted, setIsMuted]                       = useState(false);
  const [isAmbientEnabled, setIsAmbientEnabled]     = useState(false);
  const [copied, setCopied]                         = useState(false);
  const [isChatVisible, setIsChatVisible]           = useState(false);
  const [isCreatingSkill, setIsCreatingSkill]       = useState(false);
  const lyricsTimerRef                              = useRef<any>(null);
  const ambientAudioRef                             = useRef<HTMLAudioElement | null>(null);
  const fileInputRef                                = useRef<HTMLInputElement>(null);
  const [showGmailModal, setShowGmailModal]         = useState(false);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const [bgColor, setBgColor] = useState('#0a0a0a');

  useEffect(() => {
    if (isHimMode) {
      setBgColor('#0f172a');
    } else if (!isDarkMode) {
      // Tons de laranja (Amber/Orange)
      setBgColor(mood === 'angry' ? '#78350f' : '#fbbf24');
    } else {
      setBgColor(mood === 'angry' ? '#1a0a0a' : '#0a0a0a');
    }
  }, [isHimMode, mood, isDarkMode]);

  // Sound effect for currentTask
  useEffect(() => {
    if (!currentTask) return;
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playTick = () => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    };

    const intervalId = setInterval(playTick, 1000);
    
    return () => {
      clearInterval(intervalId);
      audioCtx.close().catch(() => {});
    };
  }, [currentTask]);

  const handleInfinityClick = () => {
    
    // Randomly change mood
    const moods: Mood[] = Object.keys(MOOD_CONFIG) as Mood[];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    setMood(randomMood);
    
    // Randomly change voice
    const voices: VoiceName[] = ['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir'];
    const randomVoice = voices[Math.floor(Math.random() * voices.length)];
    setVoice(randomVoice);

    // Randomly change assistant name to shift personality
    const names = ['AURORA', 'IRIS', 'LUNA', 'NOVA', 'SOLARIS', 'OSONE', 'ECHO', 'ZENITH'];
    const randomName = names[Math.floor(Math.random() * names.length)];
    setAssistantName(randomName);

    // Randomly change background color (shades of orange/warm)
    const colors = ['#FF6321', '#FF4500', '#FF8C00', '#FFA500', '#FF7F50', '#FFD700', '#E65100', '#F4511E'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setBgColor(randomColor);
  };

  const { messages: firebaseMessages, addMessage: saveMessage, deleteAll: deleteAllMessages } = useConversationHistory();

  // Clear history on mount as requested
  const hasClearedHistory = useRef(false);
  useEffect(() => {
    if (userId && !hasClearedHistory.current) {
      deleteAllMessages();
      hasClearedHistory.current = true;
    }
  }, [userId, deleteAllMessages]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [firebaseMessages]);
  const { 
    memory, diary, saveMemory, addFact, addImportantDate, addDiaryEntry, 
    updateWorkspace, clearWorkspace, addSemanticFact, addSummary, getUpcomingDates 
  } = useUserMemory();

  const MOOD_SOUNDS: Partial<Record<Mood, string>> = {
    happy: 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
    melancholic: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
    angry: 'https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3',
  };

  useEffect(() => {
    const soundUrl = MOOD_SOUNDS[mood];
    
    if (isAmbientEnabled && soundUrl) {
      if (!ambientAudioRef.current) {
        ambientAudioRef.current = new Audio();
        ambientAudioRef.current.loop = true;
        ambientAudioRef.current.volume = 0.15;
        ambientAudioRef.current.crossOrigin = "anonymous";
      }
      
      if (ambientAudioRef.current.src !== soundUrl) {
        ambientAudioRef.current.src = soundUrl;
        ambientAudioRef.current.load();
      }
      
      const playPromise = ambientAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.error("Ambient audio play error:", e);
        });
      }
    } else {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
      }
    }
  }, [isAmbientEnabled, mood]);

  const searchEmail = async (query: string) => {
    if (!imapConfig || !imapConfig.host || !imapConfig.user || !imapConfig.pass) {
      return { error: "E-mail IMAP não configurado. Peça ao usuário para configurar nas integrações." };
    }
    try {
      const response = await fetch('/api/email/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imapConfig, query })
      });
      return await response.json();
    } catch (error) {
      console.error("Error searching IMAP Email:", error);
      return { error: "Falha ao pesquisar no E-mail IMAP." };
    }
  };

  const searchSemanticMemory = async (query: string) => {
    if (!memory.semanticMemory?.length) return { results: [] };
    try {
      const queryEmbedding = await getEmbedding(query);
      const results = (memory.semanticMemory as SemanticFact[]).map(fact => {
        if (!fact.embedding) return { ...fact, similarity: 0 };
        const similarity = cosineSimilarity(queryEmbedding, fact.embedding);
        return { ...fact, similarity };
      })
      .filter(r => r.similarity > 0.7)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5);
      
      return { results: results.map(r => ({ concept: r.concept, definition: r.definition, category: r.category })) };
    } catch (error) {
      console.error("Error searching semantic memory:", error);
      return { error: "Falha na busca contextual." };
    }
  };

  const handleSaveSemanticFact = async (concept: string, definition: string, category: string) => {
    try {
      const embedding = await getEmbedding(`${concept}: ${definition}`);
      await addSemanticFact(concept, definition, category, embedding);
    } catch (error) {
      console.error("Error saving semantic fact:", error);
      await addSemanticFact(concept, definition, category);
    }
  };

  const handleSaveSummary = async (summary: string, topics: string[]) => {
    try {
      const embedding = await getEmbedding(`${summary} ${topics.join(' ')}`);
      await addSummary(summary, topics, embedding);
    } catch (error) {
      console.error("Error saving summary:", error);
      await addSummary(summary, topics);
    }
  };

  useEffect(() => {
    return () => {
      if (ambientAudioRef.current) {
        ambientAudioRef.current.pause();
        ambientAudioRef.current = null;
      }
    };
  }, []);

  const upcomingDates = useMemo(() => getUpcomingDates(), [getUpcomingDates, memory.importantDates]);

  const systemInstruction = useMemo(
    () => getSystemInstruction(assistantName, memory, mood, focusMode, upcomingDates, voice, plugins, skills, isHimMode, isDarkMode),
    [assistantName, memory, mood, focusMode, upcomingDates, voice, plugins, skills, isHimMode, isDarkMode]
  );

  const moodColor = isHimMode ? '#3b82f6' : MOOD_CONFIG[mood].color;

  const playMessageAudio = async (text: string) => {
    if (!text) return;
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      const base64Audio = part?.inlineData?.data;

      if (base64Audio) {
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const int16Array = new Int16Array(bytes.buffer);
        const float32Array = new Float32Array(int16Array.length);
        for (let i = 0; i < int16Array.length; i++) {
          float32Array[i] = int16Array[i] / 32768.0;
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const buffer = audioCtx.createBuffer(1, float32Array.length, 24000);
        buffer.getChannelData(0).set(float32Array);

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
      }
    } catch (err) {
      console.error("Erro ao gerar áudio:", err);
      setError("Não foi possível gerar o áudio da mensagem.");
    }
  };

  useEffect(() => {
    // Update theme-color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', moodColor);
    }
  }, [moodColor]);

  useEffect(() => {
    if (!voice) setVoice('Kore');
    const t1 = setInterval(() => setCurrentTime(new Date()), 1000);
    const t2 = setInterval(() => setSystemMetrics({ cpu: Math.floor(Math.random() * 15) + 5, mem: 40 + Math.floor(Math.random() * 5) }), 3000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  useEffect(() => {
    // PWA install prompt
    const handleInstallPrompt = (e: any) => { 
      e.preventDefault(); 
      setInstallPrompt(e); 
      setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setShowInstallBanner(false);
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
        setShowInstallBanner(false);
      }
      setInstallPrompt(null);
    }
  };

  const showLyricsOnScreen = useCallback((lines: string[], tempo: number = 2500) => {
    const safeTempo = Math.max(500, tempo);
    setLyrics(lines); setCurrentLyricLine(0); setIsShowingLyrics(true);
    if (lyricsTimerRef.current) clearInterval(lyricsTimerRef.current);
    let i = 0;
    lyricsTimerRef.current = setInterval(() => {
      i++;
      if (i >= lines.length) { clearInterval(lyricsTimerRef.current); setTimeout(() => setIsShowingLyrics(false), 2000); }
      else setCurrentLyricLine(i);
    }, safeTempo);
  }, []);

  const handleWebSearch = useCallback(async (query: string) => {
    setWebSearchResult('Pesquisando...');
    try {
      const searchUrl = query.startsWith('http') ? query : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      window.open(searchUrl, '_blank');
      setWebSearchResult(`Abri "${query}" em uma nova aba.`);
      setTimeout(() => setWebSearchResult(null), 4000);
    } catch (e) {
      setWebSearchResult(null);
    }
  }, []);

  const handleVoiceChange = async (newVoice: VoiceName, connected: boolean, disconnectFn: (r?: boolean) => void, connectFn: (si: string) => Promise<void>) => {
    setVoice(newVoice);
    if (connected) { disconnectFn(true); await new Promise(r => setTimeout(r, 500)); await connectFn(systemInstruction); }
  };

  // Pass mute state to hook
  const muteRef = useRef(isMuted);
  useEffect(() => { muteRef.current = isMuted; }, [isMuted]);

  const connectRef = useRef<(si: string) => Promise<void>>(async () => {});
  const disconnectRef = useRef<(r?: boolean) => void>(() => {});
  const startScreenSharingRef = useRef<() => Promise<void>>(async () => {});
  const sendLiveMessageRef = useRef<(text: string) => void>(() => {});

  const onToggleScreenSharing = useCallback(async (enabled: boolean) => { 
    if (enabled) { 
      await startScreenSharingRef.current(); 
      setIsScreenSharing(true); 
    } else {
      setIsScreenSharing(false); 
    }
  }, [setIsScreenSharing]);

  const onChangeVoice = useCallback((v: VoiceName) => handleVoiceChange(v, isConnected, disconnectRef.current, connectRef.current), [handleVoiceChange, isConnected]);
  const onOpenUrl = useCallback((url: string) => window.open(url, '_blank'), []);
  const onInteract = useCallback((action: string, x?: number, y?: number, text?: string) => {
    if (x !== undefined && y !== undefined) {
      const el = document.createElement('div');
      el.className = 'fixed pointer-events-none z-[9999] w-6 h-6 rounded-full border-2 border-white animate-ping';
      el.style.cssText = `left:${x - 12}px;top:${y - 12}px;background:${moodColor}60`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }
  }, [moodColor]);

  const onMessage = useCallback(async (msg: { role: 'user' | 'model'; text: string; imageUrl?: string }) => {
    // Neural Brain Processing
    if (msg.role === 'user') {
      const prediction = await neuralBrain.predictMood(msg.text);
      console.log('🧠 Neural Prediction:', prediction);
      if (prediction.confidence > 0.7 && prediction.mood !== mood) {
        setMood(prediction.mood as Mood);
      }
    }

    // Skip messages that are entirely internal reasoning
    const isInternalReasoning = /^\*\*[A-Z]/.test(msg.text.trim());
    if (!isInternalReasoning) {
      const cleanText = msg.text.replace(/\*\*[^*]+\*\*\s*/g, '').trim();
      if (cleanText) saveMessage({ role: msg.role, text: cleanText });
    }
    if (msg.role === 'user') {
      const match = msg.text.match(/meu nome é (\w+)/i);
      if (match) saveMemory({ userName: match[1] });
    }
  }, [mood, setMood, saveMessage, saveMemory]);

  const onToolCall = useCallback((toolName: string, args: any) => {
    if (toolName === 'show_lyrics' && args.lines) showLyricsOnScreen(args.lines, args.tempo);
    if (toolName === 'set_mood' && args.mood) setMood(args.mood as Mood);
    if (toolName === 'set_focus_mode' && typeof args.enabled === 'boolean') setFocusMode(args.enabled);
    if (toolName === 'set_dark_mode' && typeof args.enabled === 'boolean') setIsDarkMode(args.enabled);
    if (toolName === 'save_profile_info' && args.field && args.value) {
      setUserProfile({ [args.field]: args.value });
    }
    if (toolName === 'save_memory') {
      if (args.userName) saveMemory({ userName: args.userName });
      if (args.fact) addFact(args.fact);
    }
    if (toolName === 'add_important_date' && args.label && args.date) {
      addImportantDate({ label: args.label, date: args.date, year: args.year });
    }
    if (toolName === 'write_diary' && args.content) {
      addDiaryEntry(args.content, mood);
    }
    if (toolName === 'update_workspace' && args.content) {
      updateWorkspace(args.content);
      setScreen('workspace');
    }
    if (toolName === 'clear_workspace') {
      clearWorkspace();
    }
    if (toolName === 'save_semantic_fact' && args.concept && args.definition && args.category) {
      handleSaveSemanticFact(args.concept, args.definition, args.category);
    }
    if (toolName === 'search_semantic_memory' && args.query) {
      searchSemanticMemory(args.query).then(res => sendLiveMessageRef.current(`RESULTADO DA BUSCA SEMÂNTICA: ${JSON.stringify(res)}`));
    }
    if (toolName === 'search_email' && args.query) {
      searchEmail(args.query).then(res => sendLiveMessageRef.current(`RESULTADO DA BUSCA NO E-MAIL IMAP: ${JSON.stringify(res)}`));
    }
    if (toolName === 'save_conversation_summary' && args.summary && args.topics) {
      handleSaveSummary(args.summary, args.topics);
    }
    if (toolName === 'search_web' && args.query) {
      handleWebSearch(args.query);
    }
  }, [showLyricsOnScreen, setMood, setFocusMode, setIsDarkMode, setUserProfile, saveMemory, addFact, addImportantDate, addDiaryEntry, mood, updateWorkspace, clearWorkspace, handleSaveSemanticFact, searchSemanticMemory, searchEmail, handleSaveSummary, handleWebSearch]);

  const { connect, disconnect, startScreenSharing, sendMessage, sendLiveMessage, sendFile } = useGeminiLive({
    isMuted,
    systemInstruction,
    onToggleScreenSharing,
    onChangeVoice,
    onOpenUrl,
    onInteract,
    onMessage,
    onToolCall
  });

  useEffect(() => {
    connectRef.current = connect;
    disconnectRef.current = disconnect;
    startScreenSharingRef.current = startScreenSharing;
    sendLiveMessageRef.current = sendLiveMessage;
  }, [connect, disconnect, startScreenSharing, sendLiveMessage]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      setAttachPreview({ type: file.type, name: file.name, data: dataUrl });
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      if (isImage) {
        sendFile(base64, file.type, `Descreva e analise esta imagem em detalhes.`);
      } else if (isPdf) {
        sendFile(base64, file.type, `Leia e resuma o conteúdo deste documento PDF.`);
      } else {
        sendLiveMessage(`[ARQUIVO: ${file.name}] Analise o conteúdo deste arquivo.`);
      }
      setTimeout(() => setAttachPreview(null), 5000);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [sendLiveMessage, sendFile]);

  const onManualVoiceChange = (v: VoiceName) => handleVoiceChange(v, isConnected, disconnect, connect);

  const handleOrbClick = async () => {
    if (isConnected) { disconnect(); }
    else { 
      if (onboardingStep === 'initial') setOnboardingStep('completed'); 
      setIsMuted(true); // Start muted to prevent background noise interruptions
      await connect(systemInstruction); 
    }
  };

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  const statusLabel = isThinking ? 'Pensando...' : isSpeaking ? 'Falando...' : (isConnected && isMuted) ? 'Microfone Silenciado' : isListening ? 'Ouvindo...' : isConnected ? 'Toque para desligar' : 'Toque para ativar';

  return (
    <motion.div 
      animate={{ backgroundColor: bgColor }}
      transition={{ duration: 1 }}
      className="min-h-screen text-[#f5f5f5] font-sans overflow-hidden flex flex-col relative select-none"
    >
      <div className="grain-overlay" />

      {/* NEURAL BRAIN OVERLAY (Subtle) */}
      <div className="fixed top-0 right-0 z-0 opacity-20 pointer-events-none">
        <NeuralBrainView isThinking={isThinking} volume={volume} />
      </div>

      {/* PWA INSTALL BANNER */}
      <AnimatePresence>
        {showInstallBanner && installPrompt && !isInstalled && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-16 left-4 right-4 z-[60] p-4 rounded-3xl border backdrop-blur-xl shadow-2xl flex items-center justify-between gap-4"
            style={{ backgroundColor: `${moodColor}15`, borderColor: `${moodColor}30` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl" style={{ backgroundColor: `${moodColor}20` }}>
                📱
              </div>
              <div>
                <h3 className="text-xs font-medium">Instalar OSONE</h3>
                <p className="text-[10px] text-white/40">Adicione à sua tela de início para acesso rápido.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInstallBanner(false)}
                className="px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest text-white/40 hover:text-white transition-all"
              >
                Agora não
              </button>
              <button
                onClick={handleInstallApp}
                className="px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-medium transition-all shadow-lg"
                style={{ backgroundColor: moodColor, color: '#000' }}
              >
                Instalar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {onboardingStep === 'supernova' && <Supernova onComplete={() => { setOnboardingStep('completed'); connect(systemInstruction); setTimeout(() => sendLiveMessage("Oi, estou aqui."), 2500); }} />}
      
      {/* INFINITY SYMBOL - CENTER */}
      <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-[5]">
        <motion.div
          animate={{ 
            scale: 1,
            opacity: isConnected ? [0.6, 1, 0.6] : 0.6,
            filter: isConnected ? ['drop-shadow(0 0 10px rgba(255,255,255,0.2))', 'drop-shadow(0 0 40px rgba(255,255,255,0.6))', 'drop-shadow(0 0 10px rgba(255,255,255,0.2))'] : 'drop-shadow(0 0 10px rgba(255,255,255,0.2))'
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          onClick={handleInfinityClick}
          className="pointer-events-auto cursor-pointer p-12 hover:scale-110 transition-transform active:scale-95"
          title={isHimMode ? "Voltar ao OSONE normal" : "Ativar HIM Mode"}
        >
          {isHimMode ? (
            <div className="w-32 h-32 rounded-full bg-blue-500 shadow-[0_0_60px_rgba(59,130,246,0.8)] animate-pulse flex items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-blue-400/50 blur-sm" />
            </div>
          ) : (
            <InfinityIcon 
              size={200} 
              color={isConnected ? moodColor : "white"} 
              strokeWidth={0.5} 
            />
          )}
        </motion.div>
        
        {/* TASK INDICATOR */}
        <AnimatePresence>
          {currentTask && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 text-xs tracking-widest uppercase font-medium"
              style={{ backgroundColor: `${moodColor}20`, color: moodColor }}
            >
              {currentTask}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Mascot3D onToggleVoice={handleOrbClick} />

      {/* TOP BAR */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div 
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 h-14 px-5 flex items-center justify-between z-50 bg-white/5 backdrop-blur-md border-b border-white/5"
          >
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest opacity-30">
              {/* Hamburger */}
              <button
                onClick={() => setIsMenuOpen(true)}
                className="flex flex-col gap-[4px] items-center justify-center opacity-100 hover:opacity-70 transition-all"
              >
                <span className="block h-[2px] w-4 rounded-full bg-white" />
                <span className="block h-[2px] w-4 rounded-full bg-white" />
                <span className="block h-[2px] w-4 rounded-full bg-white" />
              </button>
              <span>{currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="hidden sm:inline">CPU {systemMetrics.cpu}%</span>
            </div>
            <div className="flex items-center gap-2">
              {memory.workspace && (
                <button onClick={() => setScreen('workspace')} className="flex items-center gap-1 px-2 py-1 rounded-full text-[9px] uppercase tracking-widest animate-pulse" style={{ backgroundColor: `${moodColor}20`, color: moodColor, border: `1px solid ${moodColor}40` }}>
                  📝 Ver Workspace
                </button>
              )}
              <button onClick={() => { setActiveSettingsTab('personality'); setIsSettingsOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all"
                style={{ borderColor: `${moodColor}40`, backgroundColor: `${moodColor}10` }}>
                <span className="text-xs">{MOOD_CONFIG[mood].emoji}</span>
                <span className="text-[9px] uppercase tracking-widest hidden sm:inline" style={{ color: moodColor }}>{MOOD_CONFIG[mood].label}</span>
              </button>
              <button onClick={() => setFocusMode(!focusMode)}
                className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all border"
                style={focusMode ? { backgroundColor: '#00cec920', color: '#00cec9', borderColor: '#00cec940' } : { backgroundColor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {focusMode ? '🎯' : '○'}
              </button>
              <button onClick={() => setIsAmbientEnabled(!isAmbientEnabled)}
                className="px-2.5 py-1 rounded-full text-[9px] uppercase tracking-widest transition-all border flex items-center gap-1.5"
                style={isAmbientEnabled ? { backgroundColor: `${moodColor}20`, color: moodColor, borderColor: `${moodColor}40` } : { backgroundColor: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', borderColor: 'rgba(255,255,255,0.08)' }}>
                {isAmbientEnabled ? <Volume2 size={10} /> : <VolumeX size={10} />}
                {isAmbientEnabled ? 'Som ON' : 'Som OFF'}
              </button>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'animate-pulse' : 'bg-zinc-600'}`} style={{ backgroundColor: isConnected ? moodColor : undefined }} />
                <span className="text-[9px] uppercase tracking-widest opacity-50 hidden sm:inline">{isConnected ? 'Ativo' : 'Offline'}</span>
              </div>
              <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-white/5 rounded-full opacity-40 hover:opacity-100 transition-all"><Settings size={16} /></button>
              <button onClick={() => setIsRestarting(true)} className="p-2 hover:bg-white/5 rounded-full opacity-40 hover:opacity-100 transition-all" style={{ color: moodColor }}><Power size={16} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD CONTAINER - ANCHORED AT TOP */}
      {!isConnected && (
        <div id="ai-hud-container">
          {/* 1. AUDIO WAVES */}
          <div className="w-full h-24 pointer-events-none">
            <div className="w-full h-full focus:outline-none">
              <VoiceOrb 
                isSpeaking={isSpeaking} 
                isListening={isListening} 
                isThinking={isThinking} 
                isConnected={isConnected} 
                isMuted={isMuted} 
                volume={volume} 
                moodColor={moodColor} 
              />
            </div>
          </div>

          {/* STATUS INDICATOR */}
          <div className="flex flex-col items-center pointer-events-none mt-2">
            <motion.p key={statusLabel} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="text-[9px] font-light tracking-[0.4em] uppercase opacity-40"
              style={{ color: isConnected ? moodColor : '#ffffff' }}>
              {statusLabel}
            </motion.p>
          </div>
        </div>
      )}

      {/* 2. CHAT TRANSCRIPT (3 Messages Max) - NOW AT BOTTOM */}
      <AnimatePresence>
        {isChatVisible && firebaseMessages.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="chat-transcript overflow-hidden" 
            ref={transcriptRef}
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <AnimatePresence initial={false}>
              {firebaseMessages.slice(0, 3).reverse().map((msg, idx) => (
                <motion.div 
                  key={msg.id || idx}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className={`transcript-line ${msg.role === 'user' ? 'items-end text-right' : 'items-start text-left'}`}
                >
                  <span className={`px-4 py-2 rounded-2xl max-w-[85%] break-words flex items-start gap-2 ${
                    msg.role === 'user' 
                      ? 'bg-white/10 text-[#BBBBBB] rounded-tr-none flex-row-reverse' 
                      : 'bg-white/5 text-white rounded-tl-none'
                  }`}
                  style={{ backdropFilter: 'blur(5px)' }}>
                    <div className="flex-1">
                      {msg.text}
                      {msg.imageUrl && (
                        <img src={msg.imageUrl} alt="Generated" className="mt-2 rounded-xl w-full max-w-[200px] border border-white/10" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    {msg.role === 'model' && (
                      <button 
                        onClick={() => playMessageAudio(msg.text)}
                        className="mt-1 p-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
                        title="Ouvir mensagem"
                      >
                        <Volume2 size={14} className="opacity-40 hover:opacity-100" />
                      </button>
                    )}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative w-full mx-auto px-4 pt-4 mt-64 min-h-0">
        {/* Spacer for HUD */}
        <div className="h-20" />

        <AnimatePresence>
          {webSearchResult && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[2] px-4 py-2 rounded-2xl text-xs text-center max-w-xs"
              style={{ backgroundColor: `${moodColor}15`, border: `1px solid ${moodColor}30`, color: moodColor }}>
              🔍 {webSearchResult}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isShowingLyrics && lyrics.length > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10] w-full max-w-sm text-center px-6 py-8 rounded-3xl border shadow-2xl backdrop-blur-xl"
              style={{ backgroundColor: `${moodColor}20`, borderColor: `${moodColor}50` }}>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-[10px] uppercase tracking-[0.3em] font-medium" style={{ color: moodColor }}>♪ Cantando</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.p key={currentLyricLine} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="text-xl font-light leading-relaxed" style={{ color: '#FFFFFF', textShadow: `0 0 20px ${moodColor}50` }}>
                  {lyrics[currentLyricLine]}
                </motion.p>
              </AnimatePresence>
              <div className="flex justify-center gap-1.5 mt-6">
                {lyrics.map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                    style={{ backgroundColor: i === currentLyricLine ? moodColor : `${moodColor}30`, transform: i === currentLyricLine ? 'scale(1.2)' : 'scale(1)' }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attach preview toast */}
        <AnimatePresence>
          {attachPreview && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[2] flex items-center gap-3 px-4 py-3 rounded-2xl border max-w-xs w-full"
              style={{ backgroundColor: `${moodColor}15`, borderColor: `${moodColor}30` }}>
              {attachPreview.type.startsWith('image/') ? (
                <img src={attachPreview.data} alt="preview" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${moodColor}20` }}>
                  {attachPreview.type === 'application/pdf' ? '📄' : '📝'}
                </div>
              )}
              <div>
                <p className="text-xs font-medium" style={{ color: moodColor }}>{attachPreview.name}</p>
                <p className="text-[10px] text-white/30">Enviado para análise</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute top-40 left-1/2 -translate-x-1/2 z-[5] bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 text-center max-w-xs w-full">
              <p className="text-red-400 text-xs mb-2">{error}</p>
              <button onClick={() => setError(null)} className="text-[10px] uppercase tracking-widest text-white/30 hover:text-white">Limpar</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* INPUT LAYER - z-index: 3 */}
      <div className="fixed bottom-0 left-0 right-0 z-[3] px-4 pt-10"
        style={{ 
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 16px))',
          background: isChatVisible && firebaseMessages.length > 0 ? 'linear-gradient(to top, #050505, transparent)' : 'transparent'
        }}>
        
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" onChange={handleFileChange} />

        <div className="max-w-3xl mx-auto relative flex items-center">
          {/* Chat Toggle Button */}
          <button 
            onClick={() => setIsChatVisible(!isChatVisible)}
            className="absolute -top-12 left-0 p-2 text-white/40 hover:text-white transition-all bg-white/5 rounded-full border border-white/10"
            title={isChatVisible ? "Fechar chat" : "Ver mensagens"}
          >
            {isChatVisible ? <ChevronLeft size={20} className="-rotate-90" /> : <ChevronLeft size={20} className="rotate-90" />}
          </button>

          <AnimatePresence>
            {!isConnected && (
              <motion.input
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: '100%' }}
                exit={{ opacity: 0, width: 0 }}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSendText();
                  }
                }}
                placeholder="Digite ou pergunte algo..."
                className="w-full bg-transparent border border-white/10 rounded-full py-4 pl-12 pr-32 text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
                style={{ backdropFilter: 'blur(10px)' }}
              />
            )}
          </AnimatePresence>
          
          {/* Attachment Icon */}
          {!isConnected && (
            <button
              onClick={() => { fileInputRef.current?.click(); }}
              className="absolute left-4 text-white/40 hover:text-white transition-colors"
            >
              <Paperclip size={20} />
            </button>
          )}

          {/* Right Icons / Centered Mic when Connected */}
          <div className={`${isConnected ? 'w-full flex justify-center' : 'absolute right-2 flex items-center gap-1'}`}>
            {inputText.trim() && !isConnected ? (
              <button
                onClick={handleSendText}
                className="p-2 text-white/40 hover:text-white transition-colors"
              >
                <Send size={20} />
              </button>
            ) : (
              <motion.button
                layout
                onClick={() => {
                  if (isConnected) {
                    setIsMuted(!isMuted);
                  } else {
                    handleOrbClick();
                  }
                }}
                className={`p-4 transition-all relative rounded-full ${isConnected ? 'bg-white/5 border border-white/10' : ''}`}
                style={{ 
                  color: isConnected && !isMuted ? moodColor : 'rgba(255,255,255,0.4)',
                  scale: isConnected ? 2.5 : 1
                }}
                title={isConnected ? (isMuted ? 'Ativar microfone' : 'Silenciar microfone') : 'Conectar'}
              >
                {isMuted ? <MicOff size={isConnected ? 24 : 20} /> : <Mic size={isConnected ? 24 : 20} />}
                {isConnected && !isMuted && (
                  <motion.div 
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className="absolute inset-0 rounded-full border-2 border-white/20"
                  />
                )}
              </motion.button>
            )}
            
            {isConnected && (
              <button 
                onClick={() => disconnect()} 
                className="absolute right-0 p-2 text-white/40 hover:text-red-400 transition-colors"
                title="Desconectar"
              >
                <PhoneOff size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* HAMBURGER MENU */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-black/60 backdrop-blur-2xl border-t border-white/10 rounded-t-3xl p-6 space-y-2"
              style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 16px))' }}
            >
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4" />

              <button onClick={() => { setScreen('history'); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all hover:bg-white/5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${moodColor}20` }}>
                  <History size={20} style={{ color: moodColor }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Histórico</p>
                  <p className="text-[10px] text-white/30">Conversas anteriores</p>
                </div>
              </button>

              <button onClick={() => { setScreen('diary'); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all hover:bg-white/5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${moodColor}20` }}>
                  <BookOpen size={20} style={{ color: moodColor }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Diário</p>
                  <p className="text-[10px] text-white/30">Reflexões de {assistantName}</p>
                </div>
              </button>

              <button onClick={() => { setScreen('workspace'); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all hover:bg-white/5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${moodColor}20` }}>
                  <FileText size={20} style={{ color: moodColor }} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Área de Trabalho</p>
                  <p className="text-[10px] text-white/30">Textos e códigos gerados</p>
                </div>
              </button>

              <button onClick={() => { setIsMascotVisible(!isMascotVisible); setIsMenuOpen(false); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all hover:bg-white/5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: `${moodColor}20` }}>
                  <span className="text-xl">👾</span>
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">Mascote</p>
                  <p className="text-[10px] text-white/30">{isMascotVisible ? 'Visível' : 'Oculto'}</p>
                </div>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HISTORY SCREEN */}
      <AnimatePresence>
        {screen === 'history' && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl flex flex-col">
            <div className="h-14 px-5 flex items-center gap-4 border-b border-white/5">
              <button onClick={() => setScreen('main')} className="p-2 hover:bg-white/5 rounded-full"><ChevronLeft size={20} /></button>
              <h2 className="text-sm font-medium tracking-widest uppercase">Histórico</h2>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm('Apagar TODO o histórico? Esta ação não pode ser desfeita.')) {
                      deleteAllMessages();
                    }
                  }}
                  className="p-2 rounded-full hover:bg-red-500/20 transition-all"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {firebaseMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
                  <History size={40} /><p className="text-sm uppercase tracking-widest">Nenhuma conversa ainda</p>
                </div>
              ) : firebaseMessages.map((msg, i) => {
                const cleanText = msg.text.replace(/\*\*[^*]+\*\*\s*/g, '').trim();
                if (!cleanText) return null;
                return (
                <motion.div key={msg.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                  className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={msg.role === 'user'
                    ? { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginLeft: '2rem' }
                    : { backgroundColor: `${moodColor}0D`, border: `1px solid ${moodColor}20`, marginRight: '2rem' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] uppercase tracking-widest opacity-30">{msg.role === 'user' ? (memory.userName || 'Você') : assistantName}</span>
                    {msg.createdAt && <span className="text-[9px] opacity-20">{new Date(msg.createdAt.seconds * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  <p className="opacity-70">{cleanText}</p>
                </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DIARY SCREEN */}
      <AnimatePresence>
        {screen === 'diary' && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl flex flex-col">
            <div className="h-14 px-5 flex items-center gap-4 border-b border-white/5">
              <button onClick={() => setScreen('main')} className="p-2 hover:bg-white/5 rounded-full"><ChevronLeft size={20} /></button>
              <h2 className="text-sm font-medium tracking-widest uppercase">Diário de {assistantName}</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {diary.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
                  <BookOpen size={40} /><p className="text-sm uppercase tracking-widest">Nenhuma entrada ainda</p>
                  <p className="text-xs text-center opacity-60">Converse com {assistantName} e ela escreverá seus pensamentos aqui</p>
                </div>
              ) : diary.map((entry, i) => (
                <motion.div key={entry.id || i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="p-5 rounded-3xl border space-y-2"
                  style={{ backgroundColor: `${moodColor}08`, borderColor: `${moodColor}20` }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{entry.mood ? MOOD_CONFIG[entry.mood as Mood]?.emoji || '📝' : '📝'}</span>
                    {entry.createdAt && (
                      <span className="text-[10px] opacity-30">
                        {formatDate(entry.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed opacity-70 italic">"{entry.content}"</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WORKSPACE SCREEN */}
      <AnimatePresence>
        {screen === 'workspace' && (
          <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl flex flex-col">
            <div className="h-14 px-5 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-4">
                <button onClick={() => setScreen('main')} className="p-2 hover:bg-white/5 rounded-full"><ChevronLeft size={20} /></button>
                <h2 className="text-sm font-medium tracking-widest uppercase">Área de Trabalho</h2>
              </div>
              {memory.workspace && (
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(memory.workspace || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 rounded-full transition-all"
                >
                  {copied ? (
                    <span className="text-[10px] uppercase tracking-widest text-emerald-400">Copiado!</span>
                  ) : (
                    <Copy size={16} className="opacity-60" />
                  )}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {!memory.workspace ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20">
                  <Code size={40} /><p className="text-sm uppercase tracking-widest">Workspace vazio</p>
                  <p className="text-xs text-center opacity-60">Peça para {assistantName}: "Escreva um código em Python para mim"</p>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/[0.05] relative group">
                    <pre className="text-sm leading-relaxed font-mono whitespace-pre-wrap break-words opacity-80">
                      {memory.workspace}
                    </pre>
                  </div>
                  <div className="flex justify-center pb-10">
                    <button onClick={() => setScreen('main')} className="px-8 py-3 rounded-full text-[10px] uppercase tracking-[0.2em] border border-white/10 hover:bg-white/5 transition-all opacity-40">
                      Voltar para {assistantName}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RESTART MODAL */}
      <AnimatePresence>
        {isRestarting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 text-center space-y-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: `${moodColor}20` }}>
                <Power size={28} style={{ color: moodColor }} />
              </div>
              <div>
                <h2 className="text-lg font-light mb-2">Reiniciar Sistema?</h2>
                <p className="text-sm text-white/40">Isso apagará o histórico local.</p>
              </div>
              <div className="flex flex-col gap-3">
                <button onClick={() => { resetSystem(); setIsRestarting(false); window.location.reload(); }}
                  className="w-full py-4 text-white rounded-2xl text-xs uppercase tracking-widest" style={{ backgroundColor: moodColor }}>
                  Confirmar
                </button>
                <button onClick={() => setIsRestarting(false)} className="w-full py-4 bg-white/5 text-white/60 rounded-2xl text-xs uppercase tracking-widest">Cancelar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SETTINGS MODAL */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSettingsOpen(false)}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center sm:p-6">
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col max-h-[85vh]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-base font-medium">Configurações</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X size={18} /></button>
              </div>
              <div className="flex border-b border-white/5 overflow-x-auto">
                {(['voice', 'personality', 'mascot', 'store', 'integrations', 'system', 'keys'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveSettingsTab(tab)}
                    className="flex-1 py-3 text-[10px] uppercase tracking-widest transition-all border-b-2 whitespace-nowrap px-2"
                    style={activeSettingsTab === tab ? { borderColor: moodColor, color: 'white' } : { borderColor: 'transparent', color: 'rgba(255,255,255,0.3)' }}>
                    {tab === 'voice' ? 'Voz' : tab === 'personality' ? 'Humor' : tab === 'mascot' ? 'Mascote' : tab === 'store' ? 'Loja' : tab === 'integrations' ? 'Integrações' : tab === 'keys' ? 'Chaves API' : 'Sistema'}
                  </button>
                ))}
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <AnimatePresence mode="wait">
                  {activeSettingsTab === 'voice' && (
                    <motion.div key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 opacity-40">
                          <span className="text-xs">♀</span>
                          <label className="text-[9px] uppercase tracking-[0.2em]">Feminino</label>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {(['Kore', 'Zephyr'] as VoiceName[]).map(v => (
                            <button key={v} onClick={() => onManualVoiceChange(v)}
                              className="w-full p-4 rounded-2xl text-left transition-all border"
                              style={voice === v 
                                ? { backgroundColor: `${moodColor}15`, borderColor: `${moodColor}40`, color: 'white' } 
                                : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{v}</span>
                                {voice === v && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: moodColor }} />}
                              </div>
                              <p className="text-[10px] opacity-40 mt-1">{VOICE_DESCRIPTIONS[v]}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 opacity-40">
                          <span className="text-xs">♂</span>
                          <label className="text-[9px] uppercase tracking-[0.2em]">Masculino</label>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          {(['Charon', 'Puck', 'Fenrir'] as VoiceName[]).map(v => (
                            <button key={v} onClick={() => onManualVoiceChange(v)}
                              className="w-full p-4 rounded-2xl text-left transition-all border"
                              style={voice === v 
                                ? { backgroundColor: `${moodColor}15`, borderColor: `${moodColor}40`, color: 'white' } 
                                : { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{v}</span>
                                {voice === v && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: moodColor }} />}
                              </div>
                              <p className="text-[10px] opacity-40 mt-1">{VOICE_DESCRIPTIONS[v]}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {activeSettingsTab === 'personality' && (
                    <motion.div key="personality" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                      <div className="space-y-3">
                        <label className="text-[10px] uppercase tracking-widest opacity-40 block">Humor Atual</label>
                        {(Object.entries(MOOD_CONFIG) as [Mood, typeof MOOD_CONFIG[Mood]][]).map(([key, config]) => (
                          <button key={key} onClick={() => setMood(key)}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-left"
                            style={mood === key ? { backgroundColor: `${config.color}20`, border: `1px solid ${config.color}40` } : { backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <span className="text-xl">{config.emoji}</span>
                            <p className="text-sm font-medium" style={{ color: mood === key ? config.color : 'rgba(255,255,255,0.7)' }}>{config.label}</p>
                            {mood === key && <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />}
                          </button>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between p-4 bg-orange-500/10 rounded-2xl border border-orange-500/20">
                          <div>
                            <p className="text-sm font-bold text-orange-400">☀️ Modo Claro (Laranja)</p>
                            <p className="text-[10px] text-orange-400/60 mt-0.5">Mudar para tons de laranja</p>
                          </div>
                          <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-11 h-6 rounded-full transition-all relative"
                            style={{ backgroundColor: !isDarkMode ? '#f59e0b' : 'rgba(255,255,255,0.1)' }}>
                            <motion.div animate={{ x: !isDarkMode ? 22 : 3 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow" />
                          </button>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                          <div>
                            <p className="text-sm font-bold text-blue-400">🤵 HIM Mode</p>
                            <p className="text-[10px] text-blue-400/60 mt-0.5">Ativar persona do criador</p>
                          </div>
                          <button onClick={() => {
                            setIsHimMode(!isHimMode);
                            if (!isHimMode) {
                              setVoice('Charon');
                            }
                          }} className="w-11 h-6 rounded-full transition-all relative"
                            style={{ backgroundColor: isHimMode ? '#3b82f6' : 'rgba(255,255,255,0.1)' }}>
                            <motion.div animate={{ x: isHimMode ? 22 : 3 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow" />
                          </button>
                        </div>
                      </div>
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                          <div>
                            <p className="text-sm">🎯 Modo Foco</p>
                            <p className="text-[10px] text-white/30 mt-0.5">Respostas diretas e objetivas</p>
                          </div>
                          <button onClick={() => setFocusMode(!focusMode)} className="w-11 h-6 rounded-full transition-all relative"
                            style={{ backgroundColor: focusMode ? '#00cec9' : 'rgba(255,255,255,0.1)' }}>
                            <motion.div animate={{ x: focusMode ? 22 : 3 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow" />
                          </button>
                        </div>
                      </div>
                      {memory.userName && (
                        <div className="pt-4 border-t border-white/5 space-y-2">
                          <label className="text-[10px] uppercase tracking-widest opacity-40 block">Memória</label>
                          <div className="p-4 bg-white/5 rounded-2xl space-y-1">
                            <p className="text-xs text-white/60">👤 <span className="text-white">{memory.userName}</span></p>
                            {memory.facts?.slice(-3).map((f, i) => <p key={i} className="text-xs text-white/40">• {f}</p>)}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {activeSettingsTab === 'mascot' && (
                    <motion.div key="mascot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl">
                        <span className="text-sm">Visível</span>
                        <button onClick={() => setIsMascotVisible(!isMascotVisible)} className="w-11 h-6 rounded-full transition-all relative"
                          style={{ backgroundColor: isMascotVisible ? moodColor : 'rgba(255,255,255,0.1)' }}>
                          <motion.div animate={{ x: isMascotVisible ? 22 : 3 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <span className="text-[10px] uppercase tracking-widest opacity-30">Cor</span>
                        <div className="flex gap-2 flex-wrap">
                          {['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead', '#a29bfe'].map(color => (
                            <button key={color} onClick={() => setMascotAppearance({ primaryColor: color })}
                              className="w-8 h-8 rounded-full border-2 transition-all"
                              style={{ backgroundColor: color, borderColor: mascotAppearance.primaryColor === color ? 'white' : 'transparent', opacity: mascotAppearance.primaryColor === color ? 1 : 0.5 }} />
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <span className="text-[10px] uppercase tracking-widest opacity-30">Olhos</span>
                        <div className="grid grid-cols-5 gap-2">
                          {(['normal', 'happy', 'cool', 'wink', 'heart'] as MascotEyeStyle[]).map(style => (
                            <button key={style} onClick={() => setMascotAppearance({ eyeStyle: style })}
                              className="py-2 rounded-lg text-base transition-all"
                              style={{ backgroundColor: mascotAppearance.eyeStyle === style ? `${moodColor}30` : 'rgba(255,255,255,0.05)' }}>
                              {style === 'normal' ? '👀' : style === 'happy' ? '😊' : style === 'cool' ? '😎' : style === 'wink' ? '😉' : '❤️'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {activeSettingsTab === 'store' && (
                    <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                      {isCreatingSkill ? (
                        <SkillCreator onClose={() => setIsCreatingSkill(false)} />
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 opacity-40">
                              <ShoppingBag size={14} />
                              <span className="text-[10px] uppercase tracking-widest">Loja de Plugins</span>
                            </div>
                            <div className="flex gap-2">
                              {['tool', 'skin', 'personality'].map(cat => (
                                <span key={cat} className="text-[8px] uppercase tracking-tighter px-2 py-0.5 rounded-full bg-white/5 opacity-40 border border-white/10">
                                  {cat}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-3">
                            {plugins.map(plugin => (
                              <div key={plugin.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between group hover:bg-white/[0.08] transition-all">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl group-hover:scale-110 transition-transform">{plugin.icon}</span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium">{plugin.name}</p>
                                      <span className="text-[8px] uppercase opacity-30 px-1.5 py-0.5 rounded border border-white/10">{plugin.category}</span>
                                    </div>
                                    <p className="text-[10px] text-white/40">{plugin.description}</p>
                                    {plugin.price && !plugin.installed && (
                                      <p className="text-[9px] mt-1" style={{ color: moodColor }}>{plugin.price} créditos</p>
                                    )}
                                  </div>
                                </div>
                                <button 
                                  onClick={() => togglePlugin(plugin.id)}
                                  className="px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest font-medium transition-all"
                                  style={{ 
                                    backgroundColor: plugin.installed ? 'rgba(255,255,255,0.05)' : moodColor,
                                    color: plugin.installed ? 'rgba(255,255,255,0.4)' : '#fff',
                                    border: plugin.installed ? '1px solid rgba(255,255,255,0.1)' : 'none'
                                  }}>
                                  {plugin.installed ? 'Remover' : 'Instalar'}
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="pt-6 border-t border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 opacity-40">
                                <ZapIcon size={14} />
                                <span className="text-[10px] uppercase tracking-widest">Suas Habilidades</span>
                              </div>
                              <button 
                                onClick={() => setIsCreatingSkill(true)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                              >
                                <Plus size={12} />
                                <span className="text-[9px] uppercase tracking-widest">Criar</span>
                              </button>
                            </div>

                            {skills.length === 0 ? (
                              <div className="p-8 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 opacity-20">
                                <SparklesIcon size={24} />
                                <p className="text-[10px] uppercase tracking-widest">Nenhuma habilidade criada</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 gap-3">
                                {skills.map(skill => (
                                  <div key={skill.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className="text-2xl">{skill.icon}</span>
                                      <div>
                                        <p className="text-sm font-medium">{skill.name}</p>
                                        <p className="text-[10px] text-white/40 line-clamp-1">{skill.description}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => toggleSkill(skill.id)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${skill.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}
                                      >
                                        <Check size={16} />
                                      </button>
                                      <button 
                                        onClick={() => removeSkill(skill.id)}
                                        className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-white/20 hover:bg-red-500/20 hover:text-red-400 transition-all"
                                      >
                                        <TrashIcon size={16} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}
                  {activeSettingsTab === 'integrations' && (
                    <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                      <IntegrationsTab />
                      
                      <div className="space-y-4 pt-6 border-t border-white/5">
                        <div className="flex items-center gap-2 opacity-40 px-4">
                          <Monitor size={14} />
                          <span className="text-[10px] uppercase tracking-widest">E-mail IMAP</span>
                        </div>
                        
                        <div className="p-4 mx-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                              <Monitor size={20} className="text-blue-500" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">Outros Provedores</p>
                              <p className="text-[10px] opacity-40">{imapConfig ? 'Configurado' : 'Não configurado'}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-1">Servidor IMAP</label>
                              <input 
                                type="text" 
                                placeholder="imap.exemplo.com"
                                value={imapConfig?.host || ''}
                                onChange={(e) => setImapConfig({ ...imapConfig, host: e.target.value, port: imapConfig?.port || 993, secure: imapConfig?.secure ?? true })}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                              />
                            </div>
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-1">E-mail</label>
                                <input 
                                  type="email" 
                                  placeholder="seu@email.com"
                                  value={imapConfig?.user || ''}
                                  onChange={(e) => setImapConfig({ ...imapConfig, user: e.target.value })}
                                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-[10px] uppercase tracking-widest opacity-40 block mb-1">Senha (ou App Password)</label>
                                <input 
                                  type="password" 
                                  placeholder="••••••••"
                                  value={imapConfig?.pass || ''}
                                  onChange={(e) => setImapConfig({ ...imapConfig, pass: e.target.value })}
                                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/30"
                                />
                              </div>
                            </div>
                            {imapConfig && (!imapConfig.host || !imapConfig.user || !imapConfig.pass) && (
                              <p className="text-[10px] text-red-400">Preencha todos os campos para ativar.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {activeSettingsTab === 'system' && (
                    <motion.div key="system" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                      
                      {/* Token Usage Monitor */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-widest opacity-40">Uso de Tokens (Hoje)</span>
                          <span className="text-[10px] opacity-40">{useAppStore.getState().tokenUsage.date}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-2xl font-light">{useAppStore.getState().tokenUsage.totalTokens.toLocaleString()}</p>
                            <p className="text-[10px] text-white/40 mt-1">Modelo: {useAppStore.getState().tokenUsage.model}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-white/60">Limite Diário</p>
                            <p className="text-[10px] text-white/40">~1.000.000 (Free)</p>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#e07a5f]" style={{ width: `${Math.min((useAppStore.getState().tokenUsage.totalTokens / 1000000) * 100, 100)}%` }} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 opacity-40">
                          <Cpu size={14} />
                          <span className="text-[10px] uppercase tracking-widest">Informações do Sistema</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">CPU</p>
                            <p className="text-xl font-light">{systemMetrics.cpu}%</p>
                          </div>
                          <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Memória</p>
                            <p className="text-xl font-light">{systemMetrics.mem}%</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2 opacity-40">
                          <Download size={14} />
                          <span className="text-[10px] uppercase tracking-widest">Aplicação PWA</span>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">Status de Instalação</p>
                              <p className="text-[10px] text-white/30">{isInstalled ? 'Instalado no dispositivo' : 'Disponível para instalação'}</p>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${isInstalled ? 'bg-green-500' : 'bg-yellow-500'}`} />
                          </div>
                          
                          {!isInstalled && (
                            <div className="space-y-4">
                              {window.self !== window.top ? (
                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                                  <p className="text-xs text-blue-400 mb-2">⚠️ Instalação bloqueada pelo AI Studio</p>
                                  <p className="text-[10px] text-white/40 leading-relaxed">
                                    O navegador não permite a instalação de PWAs dentro de um iframe. 
                                    Para instalar o OSONE, abra o aplicativo em uma <strong>nova aba</strong> usando o botão no topo da página do AI Studio.
                                  </p>
                                </div>
                              ) : (
                                <button
                                  onClick={handleInstallApp}
                                  disabled={!installPrompt}
                                  className={`w-full py-4 rounded-2xl text-xs uppercase tracking-widest font-medium transition-all flex items-center justify-center gap-2 ${installPrompt ? 'bg-white text-black hover:bg-white/90' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}
                                  style={installPrompt ? { backgroundColor: moodColor, color: '#000' } : {}}
                                >
                                  <Download size={14} />
                                  {installPrompt ? 'Instalar Agora' : 'Aguardando Navegador...'}
                                </button>
                              )}
                              
                              {!installPrompt && window.self === window.top && (
                                <p className="text-[9px] text-center text-white/20 px-4">
                                  Se o botão não ativar, verifique se o seu navegador suporta PWA ou se o app já está instalado.
                                </p>
                              )}
                            </div>
                          )}
                          
                          {isInstalled && (
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                              <p className="text-[10px] text-green-400 uppercase tracking-widest">Você já está usando a versão instalada</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                        <button onClick={() => setIsRestarting(true)} className="w-full py-4 bg-red-500/10 text-red-500 rounded-2xl text-xs uppercase tracking-widest font-medium hover:bg-red-500/20 transition-all flex items-center justify-center gap-2">
                          <Power size={14} />
                          Reiniciar Sistema
                        </button>
                      </div>
                    </motion.div>
                  )}
                  {activeSettingsTab === 'keys' && (
                    <motion.div key="keys" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest opacity-40">Provedor de Texto</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setTextModelProvider('groq')}
                              className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-medium transition-all border ${
                                textModelProvider === 'groq'
                                  ? 'bg-white text-black border-white'
                                  : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              Groq
                            </button>
                            <button
                              onClick={() => setTextModelProvider('openai')}
                              className={`px-3 py-2 rounded-xl text-[10px] uppercase tracking-widest font-medium transition-all border ${
                                textModelProvider === 'openai'
                                  ? 'bg-white text-black border-white'
                                  : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              OpenAI
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest opacity-40">Gemini API Key (Voz/Live)</label>
                          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                            placeholder="Insira sua chave Gemini..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest opacity-40">OpenAI API Key (Texto)</label>
                          <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/20" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest opacity-40">Groq API Key (Texto)</label>
                          <input type="password" value={groqApiKey} onChange={e => setGroqApiKey(e.target.value)}
                            placeholder="gsk_..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-white/20" />
                        </div>
                        <p className="text-[10px] text-white/30 italic">As chaves são salvas localmente no seu navegador.</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="p-5 border-t border-white/5 flex flex-col gap-3">
                <p className="text-[10px] text-white/20 uppercase tracking-widest text-center">Você também pode pedir por voz</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-10 text-[9px] tracking-[0.4em] uppercase pointer-events-none">OZÔNIO v1.0</div>
    </motion.div>
  );
}