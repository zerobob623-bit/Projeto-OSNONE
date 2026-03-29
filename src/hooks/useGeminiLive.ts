import { useState, useCallback, useRef, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GoogleGenAI, Modality, Type, FunctionDeclaration } from "@google/genai";
import { useAppStore, VoiceName, VOICE_MAPPING } from '../store/useAppStore';

export interface UseGeminiLiveProps {
  onToggleScreenSharing?: (enabled: boolean) => void;
  onChangeVoice?: (voice: VoiceName) => void;
  onOpenUrl?: (url: string) => void;
  onInteract?: (action: string, x?: number, y?: number, text?: string) => void;
  onMessage?: (msg: { role: 'user' | 'model'; text: string; imageUrl?: string }) => void;
  onToolCall?: (toolName: string, args: any) => void;
  isMuted?: boolean;
  systemInstruction?: string;
}

export const useGeminiLive = ({ 
  onToggleScreenSharing, 
  onChangeVoice, 
  onOpenUrl, 
  onInteract, 
  onMessage, 
  onToolCall, 
  isMuted = false,
  systemInstruction = ""
}: UseGeminiLiveProps) => {
  const { 
    voice, 
    isConnected, setIsConnected, 
    isSpeaking, setIsSpeaking, 
    isListening, setIsListening, 
    isThinking, setIsThinking, 
    volume, setVolume, 
    error, setError, 
    history, addMessage,
    setMascotTarget,
    setMascotAction,
    setOnboardingStep,
    setAssistantName,
    apiKey: storedApiKey,
    groqApiKey,
    openaiApiKey,
    textModelProvider,
    addTokenUsage,
    plugins,
    setCurrentTask
  } = useAppStore(useShallow((state) => ({
    voice: state.voice,
    isConnected: state.isConnected, setIsConnected: state.setIsConnected,
    isSpeaking: state.isSpeaking, setIsSpeaking: state.setIsSpeaking,
    isListening: state.isListening, setIsListening: state.setIsListening,
    isThinking: state.isThinking, setIsThinking: state.setIsThinking,
    volume: state.volume, setVolume: state.setVolume,
    error: state.error, setError: state.setError,
    history: state.history, addMessage: state.addMessage,
    setMascotTarget: state.setMascotTarget,
    setMascotAction: state.setMascotAction,
    setOnboardingStep: state.setOnboardingStep,
    setAssistantName: state.setAssistantName,
    apiKey: state.apiKey,
    groqApiKey: state.groqApiKey,
    openaiApiKey: state.openaiApiKey,
    textModelProvider: state.textModelProvider,
    addTokenUsage: state.addTokenUsage,
    plugins: state.plugins,
    setCurrentTask: state.setCurrentTask
  })));

  const sessionRef = useRef<any>(null);
  const isConnectedRef = useRef(false);
  const isSpeakingRef = useRef(isSpeaking);
  const isThinkingRef = useRef(isThinking);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { isThinkingRef.current = isThinking; }, [isThinking]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioQueue = useRef<Int16Array[]>([]);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef(isMuted);
  const connectionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ FIX: Guards para evitar duplo registro do AudioWorklet processor
  const outputWorkletLoadedRef = useRef(false);
  const inputWorkletLoadedRef = useRef(false);
  const workletBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const onToggleScreenSharingRef = useRef(onToggleScreenSharing);
  const onChangeVoiceRef = useRef(onChangeVoice);
  const onOpenUrlRef = useRef(onOpenUrl);
  const onInteractRef = useRef(onInteract);
  const onMessageRef = useRef(onMessage);
  const onToolCallRef = useRef(onToolCall);

  useEffect(() => {
    onToggleScreenSharingRef.current = onToggleScreenSharing;
    onChangeVoiceRef.current = onChangeVoice;
    onOpenUrlRef.current = onOpenUrl;
    onInteractRef.current = onInteract;
    onMessageRef.current = onMessage;
    onToolCallRef.current = onToolCall;
  }, [onToggleScreenSharing, onChangeVoice, onOpenUrl, onInteract, onMessage, onToolCall]);

  // ============================================
  // 🛠️ DECLARAÇÕES DE FERRAMENTAS (TOOLS)
  // ============================================

  const toggleScreenSharingFunc: FunctionDeclaration = {
    name: "toggle_screen_sharing",
    description: "Ativa ou desativa o compartilhamento de tela para que a IA possa ver o que o usuário está fazendo.",
    parameters: {
      type: Type.OBJECT,
      properties: { enabled: { type: Type.BOOLEAN, description: "True para ativar, False para desativar." } },
      required: ["enabled"]
    }
  };

  const changeVoiceFunc: FunctionDeclaration = {
    name: "change_voice",
    description: "Altera a voz do sistema operacional (IA).",
    parameters: {
      type: Type.OBJECT,
      properties: { voice_name: { type: Type.STRING, description: "O nome da nova voz.", enum: ["Charon", "Kore", "Puck", "Zephyr", "Fenrir"] } },
      required: ["voice_name"]
    }
  };

  const openUrlFunc: FunctionDeclaration = {
    name: "open_url",
    description: "Abre uma URL ou site em uma nova aba (ex: YouTube, Google, etc).",
    parameters: {
      type: Type.OBJECT,
      properties: { url: { type: Type.STRING, description: "A URL completa para abrir." } },
      required: ["url"]
    }
  };

  const generateImageFunc: FunctionDeclaration = {
    name: "generate_image",
    description: "Gera uma imagem a partir de uma descrição textual (prompt).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: "A descrição detalhada da imagem que o usuário deseja criar." },
        aspect_ratio: { type: Type.STRING, description: "O formato da imagem (1:1, 16:9, 9:16). Padrão: 1:1", enum: ["1:1", "16:9", "9:16"] }
      },
      required: ["prompt"]
    }
  };

  const interactFunc: FunctionDeclaration = {
    name: "interact_with_screen",
    description: "Simula uma interação na tela (clique, scroll, digitar, etc).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "Ação: 'click', 'type', 'scroll_up', 'scroll_down'." },
        text: { type: Type.STRING, description: "Texto a ser digitado (se action for 'type')." },
        x: { type: Type.NUMBER, description: "Coordenada X (0-1920)." },
        y: { type: Type.NUMBER, description: "Coordenada Y (0-1080)." }
      },
      required: ["action"]
    }
  };

  const mascotControlFunc: FunctionDeclaration = {
    name: "mascot_control",
    description: "Controla as ações do mascote visualmente.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: "Ação: 'point', 'click'.", enum: ['point', 'click'] },
        target: { type: Type.STRING, description: "ID do elemento ou coordenadas (ex: 'x:500,y:300')." },
      },
      required: ["action", "target"],
    },
  };

  const saveProfileInfoFunc: FunctionDeclaration = {
    name: "save_profile_info",
    description: "Salva informações do perfil do usuário durante o onboarding.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        field: { type: Type.STRING, enum: ['hobbies', 'relationships', 'lifestyle', 'gender_preference', 'personality', 'assistant_name', 'social_level', 'mother_relationship'] },
        value: { type: Type.STRING }
      },
      required: ["field", "value"]
    }
  };

  const completeOnboardingFunc: FunctionDeclaration = {
    name: "complete_onboarding",
    description: "Finaliza o processo de onboarding e inicia a animação de nascimento (Supernova)."
  };

  const showLyricsFunc: FunctionDeclaration = {
    name: "show_lyrics",
    description: "Mostra a letra de uma música na tela linha por linha enquanto canta.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        lines: { type: Type.ARRAY, items: { type: Type.STRING }, description: "As linhas da letra." },
        tempo: { type: Type.NUMBER, description: "O tempo em ms entre cada linha." }
      },
      required: ["lines"]
    }
  };

  const setMoodFunc: FunctionDeclaration = {
    name: "set_mood",
    description: "Altera o humor atual da IA.",
    parameters: {
      type: Type.OBJECT,
      properties: { mood: { type: Type.STRING, enum: ["happy", "calm", "focused", "playful", "melancholic", "angry"] } },
      required: ["mood"]
    }
  };

  const setFocusModeFunc: FunctionDeclaration = {
    name: "set_focus_mode",
    description: "Ativa ou desativa o modo foco.",
    parameters: {
      type: Type.OBJECT,
      properties: { enabled: { type: Type.BOOLEAN } },
      required: ["enabled"]
    }
  };

  const setDarkModeFunc: FunctionDeclaration = {
    name: "set_dark_mode",
    description: "Ativa ou desativa o modo escuro (fundo preto). Se desativado, o fundo fica em tons de laranja.",
    parameters: {
      type: Type.OBJECT,
      properties: { enabled: { type: Type.BOOLEAN, description: "True para modo escuro, False para modo claro (laranja)." } },
      required: ["enabled"]
    }
  };

  const saveMemoryFunc: FunctionDeclaration = {
    name: "save_memory",
    description: "Salva informações importantes sobre o usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: { userName: { type: Type.STRING }, fact: { type: Type.STRING }, preference: { type: Type.STRING } },
      required: ["fact"]
    }
  };

  const addImportantDateFunc: FunctionDeclaration = {
    name: "add_important_date",
    description: "Salva uma data importante do usuário.",
    parameters: {
      type: Type.OBJECT,
      properties: { label: { type: Type.STRING }, date: { type: Type.STRING }, year: { type: Type.STRING } },
      required: ["label", "date"]
    }
  };

  const writeDiaryFunc: FunctionDeclaration = {
    name: "write_diary",
    description: "Escreve uma reflexão no diário.",
    parameters: {
      type: Type.OBJECT,
      properties: { content: { type: Type.STRING } },
      required: ["content"]
    }
  };

  const readUrlContentFunc: FunctionDeclaration = {
    name: "read_url_content",
    description: "Lê e extrai o conteúdo textual principal de uma página da web específica.",
    parameters: {
      type: Type.OBJECT,
      properties: { 
        url: { type: Type.STRING, description: "A URL completa da página para ler (ex: https://exemplo.com/artigo)." } 
      },
      required: ["url"]
    }
  };

  const updateWorkspaceFunc: FunctionDeclaration = {
    name: "update_workspace",
    description: "Escreve ou atualiza o conteúdo na Área de Trabalho (Workspace).",
    parameters: {
      type: Type.OBJECT,
      properties: { content: { type: Type.STRING } },
      required: ["content"]
    }
  };

  const clearWorkspaceFunc: FunctionDeclaration = {
    name: "clear_workspace",
    description: "Limpa todo o conteúdo da Área de Trabalho (Workspace)."
  };

  const saveSemanticFactFunc: FunctionDeclaration = {
    name: "save_semantic_fact",
    description: "Salva um fato semântico estruturado.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING },
        definition: { type: Type.STRING },
        category: { type: Type.STRING }
      },
      required: ["concept", "definition", "category"]
    }
  };

  const searchSemanticMemoryFunc: FunctionDeclaration = {
    name: "search_semantic_memory",
    description: "Pesquisa na memória semântica por contexto.",
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING } },
      required: ["query"]
    }
  };

  const searchEmailFunc: FunctionDeclaration = {
    name: "search_email",
    description: "Pesquisa nos e-mails do usuário usando IMAP (Outros provedores).",
    parameters: {
      type: Type.OBJECT,
      properties: { query: { type: Type.STRING } },
      required: ["query"]
    }
  };

  const saveConversationSummaryFunc: FunctionDeclaration = {
    name: "save_conversation_summary",
    description: "Salva um resumo da conversa atual.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        topics: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["summary", "topics"]
    }
  };

  const whatsappSendFunc: FunctionDeclaration = {
    name: "whatsapp_send",
    description: "Envia uma mensagem (texto, imagem ou áudio) via WhatsApp para um contato ou número.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        to: { type: Type.STRING, description: "Número do telefone com DDI (ex: 5511999999999) ou JID." },
        text: { type: Type.STRING, description: "O texto da mensagem." },
        image: { type: Type.STRING, description: "URL ou base64 da imagem (opcional)." },
        audio: { type: Type.STRING, description: "URL ou base64 do áudio (opcional)." }
      },
      required: ["to", "text"]
    }
  };

  const alexaCommandFunc: FunctionDeclaration = {
    name: "alexa_command",
    description: "Envia um comando para a Alexa (falar algo ou executar uma rotina/automação).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "O que a Alexa deve falar ou o nome da rotina." },
        deviceId: { type: Type.STRING, description: "O ID do dispositivo Alexa (opcional, usa o primeiro se vazio)." },
        type: { type: Type.STRING, enum: ["speak", "routine"], description: "Tipo de comando: 'speak' para falar, 'routine' para automação." }
      },
      required: ["command", "type"]
    }
  };

  // ============================================
  // 🧬 FUNÇÕES DE AUTO-EVOLUÇÃO (SELF-EVOLUTION)
  // ============================================

  const readFileFunc: FunctionDeclaration = {
    name: "read_file",
    description: "Lê o conteúdo de um arquivo do projeto. Use para inspecionar o código-fonte.",
    parameters: {
      type: Type.OBJECT,
      properties: { filePath: { type: Type.STRING, description: "Caminho do arquivo (ex: src/App.tsx)" } },
      required: ["filePath"]
    }
  };

  const writeFileFunc: FunctionDeclaration = {
    name: "write_file",
    description: "Escreve ou sobrescreve o conteúdo de um arquivo do projeto. Use para modificar o código-fonte.",
    parameters: {
      type: Type.OBJECT,
      properties: { 
        filePath: { type: Type.STRING, description: "Caminho do arquivo (ex: src/App.tsx)" },
        content: { type: Type.STRING, description: "Novo conteúdo do arquivo" }
      },
      required: ["filePath", "content"]
    }
  };

  const listDirectoryFunc: FunctionDeclaration = {
    name: "list_directory",
    description: "Lista os arquivos e pastas de um diretório do projeto.",
    parameters: {
      type: Type.OBJECT,
      properties: { dirPath: { type: Type.STRING, description: "Caminho do diretório (ex: src/components). Deixe vazio para a raiz." } }
    }
  };

  const executeCommandFunc: FunctionDeclaration = {
    name: "execute_command",
    description: "Executa um comando no terminal do PC (ex: npm install, ls, grep). Use com cuidado para dominar e controlar o ambiente local.",
    parameters: {
      type: Type.OBJECT,
      properties: { command: { type: Type.STRING, description: "O comando shell a ser executado." } },
      required: ["command"]
    }
  };

  // ============================================
  // 🎵 FUNÇÕES DE CONTROLE DE ÁUDIO
  // ============================================

  const stopAudio = useCallback((isReconnecting = false) => {
    if (connectionTimerRef.current) {
      clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close().catch(console.error);
      inputAudioContextRef.current = null;
    }
    // ✅ FIX: reset input worklet guard when input context is destroyed
    inputWorkletLoadedRef.current = false;

    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current = [];
    if (!isReconnecting && audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
      // ✅ FIX: reset output worklet guard when output context is destroyed
      outputWorkletLoadedRef.current = false;
    }
    setIsListening(false);
    setIsSpeaking(false);
    audioQueue.current = [];
    nextStartTimeRef.current = 0;
  }, [setIsListening, setIsSpeaking]);

  const playNextChunk = useCallback(() => {
    if (audioQueue.current.length === 0 || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Schedule up to 3 chunks in advance to prevent stuttering
    while (audioQueue.current.length > 0 && activeSourcesRef.current.length < 3) {
      const chunk = audioQueue.current.shift()!;
      const audioBuffer = ctx.createBuffer(1, chunk.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < chunk.length; i++) {
        channelData[i] = chunk[i] / 0x7FFF;
      }
      
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      const now = ctx.currentTime;
      // If we are falling behind, reset the start time to slightly in the future
      if (nextStartTimeRef.current < now) {
        nextStartTimeRef.current = now + 0.05; // Reduced buffer to 0.05s for lower latency
      }
      
      const startTime = nextStartTimeRef.current;
      source.start(startTime);
      activeSourcesRef.current.push(source);
      nextStartTimeRef.current += audioBuffer.duration;
      setIsSpeaking(true);
      
      source.onended = () => {
        activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== source);
        if (audioQueue.current.length > 0) {
          playNextChunk();
        } else if (activeSourcesRef.current.length === 0) {
          setIsSpeaking(false);
          // Reset nextStartTimeRef when queue is empty so next audio starts immediately
          nextStartTimeRef.current = 0; 
        }
      };
    }
  }, [setIsSpeaking]);

  const toBase64 = useCallback((buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as any);
    }
    return window.btoa(binary);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    addMessage({ role: 'user', text });
    onMessageRef.current?.({ role: 'user', text });
    setIsThinking(true);
    
    try {
      // Build history for context (reverse to get oldest first)
      const contextHistory = [...history].reverse().map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));
      
      const messages = [...contextHistory, { role: 'user', content: text }];
      
      // Detect image generation intent in chat
      const imageKeywords = ['gere uma imagem', 'crie uma imagem', 'gerar imagem', 'criar imagem', 'desenhe', 'faça uma imagem'];
      const lowerText = text.toLowerCase();
      const isImageRequest = imageKeywords.some(kw => lowerText.includes(kw));

      if (isImageRequest) {
        // Extract prompt - simple heuristic: remove the keyword
        let prompt = text;
        for (const kw of imageKeywords) {
          if (lowerText.includes(kw)) {
            const index = lowerText.indexOf(kw);
            prompt = text.substring(index + kw.length).trim();
            break;
          }
        }
        if (prompt) {
          await generateImage(prompt);
          return;
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: messages,
          systemInstruction: systemInstruction,
          groqApiKey: groqApiKey,
          openaiApiKey: openaiApiKey,
          textModelProvider: textModelProvider
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.text;
      
      if (data.usage?.total_tokens) {
        addTokenUsage(data.usage.total_tokens, "llama-3.3-70b-versatile");
      }

      if (replyText) {
        addMessage({ role: 'model', text: replyText });
        onMessageRef.current?.({ role: 'model', text: replyText });
      }
    } catch (err: any) {
      console.error("Error sending text message:", err);
      let errorMsg = "Desculpe, ocorreu um erro ao processar sua mensagem de texto via Groq.";
      
      if (err.message === "Groq API Key not found") {
        errorMsg = "Por favor, configure sua chave da API Groq nas Configurações para usar o chat de texto.";
      } else if (err.message.includes("429") || err.message.includes("Quota Exceeded")) {
        errorMsg = "O OS está em cooldown de tokens. Aguarde 60 segundos.";
      }
      
      addMessage({ role: 'model', text: errorMsg });
      onMessageRef.current?.({ role: 'model', text: errorMsg });
    } finally {
      setIsThinking(false);
    }
  }, [history, addMessage, setIsThinking, systemInstruction, addTokenUsage]);

  const sendLiveMessage = useCallback((text: string) => {
    if (sessionRef.current && isConnectedRef.current) {
      setIsThinking(true);
      sessionRef.current.then((session: any) => session.sendRealtimeInput({ text }));
    }
  }, [setIsThinking]);

  const sendFile = useCallback((base64Data: string, mimeType: string, prompt: string) => {
    if (sessionRef.current && isConnectedRef.current) {
      setIsThinking(true);
      sessionRef.current.then((session: any) => {
        session.sendRealtimeInput({
          video: { mimeType, data: base64Data }
        });
        setTimeout(() => {
          session.sendRealtimeInput({ text: prompt });
        }, 300);
      });
    }
  }, [setIsThinking]);

  const generateImage = useCallback(async (prompt: string, aspectRatio: "1:1" | "16:9" | "9:16" = "1:1") => {
    setIsThinking(true);
    try {
      const apiKey = storedApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found");

      const genAI = new GoogleGenAI({ apiKey });
      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio,
          },
        },
      });

      if (response.usageMetadata?.totalTokenCount) {
        addTokenUsage(response.usageMetadata.totalTokenCount, 'gemini-3.1-flash-Live-preview');
      }

      let imageUrl = '';
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const base64Data = part.inlineData.data;
            imageUrl = `data:image/png;base64,${base64Data}`;
            break;
          }
        }
      }

      if (imageUrl) {
        addMessage({ role: 'model', text: `Aqui está a imagem que você pediu: "${prompt}"`, imageUrl });
        onMessageRef.current?.({ role: 'model', text: `Gerada imagem para: ${prompt}`, imageUrl });
      } else {
        throw new Error("Nenhuma imagem foi gerada pelo modelo.");
      }
    } catch (err: any) {
      console.error("Error generating image:", err);
      let errorMsg = "Desculpe, não consegui gerar a imagem no momento. Verifique se sua chave API suporta geração de imagens.";
      
      if (err.message?.includes("429") || err.message?.includes("Quota Exceeded")) {
        errorMsg = "O OS está em cooldown de tokens. Aguarde 60 segundos.";
      }
      
      addMessage({ role: 'model', text: errorMsg });
      onMessageRef.current?.({ role: 'model', text: errorMsg });
    } finally {
      setIsThinking(false);
    }
  }, [storedApiKey, addMessage, setIsThinking, addTokenUsage]);

  // ============================================
  // 🌐 FUNÇÕES DE LEITURA DA WEB
  // ============================================

  const readUrlContent = useCallback(async (url: string): Promise<string> => {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      
      const response = await fetch('/api/read-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ao ler URL: ${response.status}`);
      }
      
      const data = await response.json();
      const text = data.text;
      
      return `📄 Conteúdo de ${url}:\n\n${text.substring(0, 10000)}${text.length > 10000 ? '\n\n⚠️ Conteúdo truncado para economia de tokens.' : ''}`;
      
    } catch (error: any) {
      console.error('Erro ao ler URL via servidor:', error);
      
      // Fallback para Jina Reader se o servidor falhar
      try {
        const readerUrl = `https://r.jina.ai/${url}`;
        const response = await fetch(readerUrl);
        if (response.ok) {
          const text = await response.text();
          return `📄 Conteúdo de ${url} (via Jina Reader):\n\n${text.substring(0, 5000)}`;
        }
      } catch {}
      
      return `❌ Não foi possível ler o conteúdo de "${url}".\n\nMotivo possível:\n• O site bloqueia acesso automatizado\n• A URL está incorreta ou inacessível\n• Conteúdo requer login ou JavaScript\n\n💡 Dica: Tente usar "search_web" para encontrar informações sobre este tópico.`;
    }
  }, []);

  // ============================================
  // 🔌 CONEXÃO COM A API GEMINI LIVE
  // ============================================

  const connect = useCallback(async (systemInstruction: string) => {
    try {
      setError(null);
      const apiKey = storedApiKey || process.env.GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("Chave de API não encontrada. Por favor, configure-a nas Configurações.");
      }

      const ai = new GoogleGenAI({ 
        apiKey: apiKey,
      });
      
      // ✅ FIX: Reutiliza o AudioContext de output se já existir e estiver aberto
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        outputWorkletLoadedRef.current = false; // reset guard para novo contexto
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Int16Array(1024);
            this.bufferIndex = 0;
          }
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input && input.length > 0) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                this.buffer[this.bufferIndex++] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
                if (this.bufferIndex >= 1024) {
                  this.port.postMessage(this.buffer.slice());
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `;

      // ✅ FIX: Cria o blob URL uma única vez e reutiliza
      if (!workletBlobUrlRef.current) {
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        workletBlobUrlRef.current = URL.createObjectURL(blob);
      }
      const url = workletBlobUrlRef.current;

      // ✅ FIX: Só chama addModule no output context se ainda não foi carregado
      if (!outputWorkletLoadedRef.current) {
        await audioContextRef.current.audioWorklet.addModule(url);
        outputWorkletLoadedRef.current = true;
      }
      
      console.log("🚀 Iniciando conexão híbrida: Gemini 3.1 Flash Live Preview (Voz) + Groq (Texto)...");

      const baseTools = [
        toggleScreenSharingFunc, changeVoiceFunc, openUrlFunc, interactFunc, 
        mascotControlFunc, saveProfileInfoFunc, completeOnboardingFunc, showLyricsFunc,
        setMoodFunc, setFocusModeFunc, saveMemoryFunc, addImportantDateFunc,
        writeDiaryFunc, updateWorkspaceFunc, clearWorkspaceFunc, saveSemanticFactFunc, 
        searchSemanticMemoryFunc, searchEmailFunc, saveConversationSummaryFunc,
        whatsappSendFunc, alexaCommandFunc, setDarkModeFunc
      ];

      if (plugins.find(p => p.id === 'web_search')?.installed) {
        baseTools.push(readUrlContentFunc);
      }
      if (plugins.find(p => p.id === 'image_gen')?.installed) {
        baseTools.push(generateImageFunc);
      }
      if (plugins.find(p => p.id === 'self_evolution')?.installed) {
        baseTools.push(readFileFunc, writeFileFunc, listDirectoryFunc, executeCommandFunc);
      }

      const sessionPromise = ai.live.connect({
        // ✅ Modelo compatível para Live API (Voz em tempo real)
        model: "gemini-3.1-flash-live-preview",
        
        config: {
          responseModalities: [Modality.AUDIO],
          ...(systemInstruction ? { systemInstruction } : {}),
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_MAPPING[voice] || 'Kore' } },
          },
          tools: [
            { googleSearch: {} },
            { functionDeclarations: baseTools }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log("✅ Conectado com sucesso à Live API!");
            setIsConnected(true);
            isConnectedRef.current = true;
            setIsListening(true);
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume();
            }
          },
          onmessage: async (message: any) => {
            if (message.serverContent?.modelTurn?.parts) {
              setIsThinking(false);
              setCurrentTask(null);
              const textParts = message.serverContent.modelTurn.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join('');
              if (textParts) {
                addMessage({ role: 'model', text: textParts });
                onMessageRef.current?.({ role: 'model', text: textParts });
              }
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const base64Data = part.inlineData.data;
                  const binaryString = atob(base64Data);
                  const len = binaryString.length;
                  const bytes = new Uint8Array(len);
                  for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const int16Array = new Int16Array(bytes.buffer, 0, Math.floor(len / 2));
                  audioQueue.current.push(int16Array);
                  if (activeSourcesRef.current.length === 0) {
                    playNextChunk();
                  }
                }
              }
            }

            if (message.serverContent?.userTurn?.parts) {
              const userText = message.serverContent.userTurn.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join('');
              if (userText) {
                addMessage({ role: 'user', text: userText });
                onMessageRef.current?.({ role: 'user', text: userText });
              }
            }

            if (message.toolCall) {
              setIsThinking(true);
              const responses: any[] = [];
              for (const call of message.toolCall.functionCalls) {
                const name = call.name;
                const args = call.args || {};
                let handled = false;

                const newTools = ['show_lyrics', 'set_mood', 'set_focus_mode', 'save_memory', 'add_important_date', 'write_diary', 'update_workspace', 'clear_workspace', 'save_semantic_fact', 'search_semantic_memory', 'search_email', 'save_conversation_summary', 'save_profile_info', 'set_dark_mode'];
                
                if (newTools.includes(name)) {
                  setCurrentTask(`Executando ${name}...`);
                  onToolCallRef.current?.(name, args);
                  responses.push({ name, id: call.id, response: { success: true } });
                  handled = true;
                  
                // === 🧬 IMPLEMENTAÇÃO: AUTO-EVOLUÇÃO ===
                } else if (name === "read_file" || name === "write_file" || name === "list_directory" || name === "execute_command") {
                  handled = true;
                  setCurrentTask(
                    name === "read_file" ? `Lendo arquivo...` : 
                    name === "write_file" ? `Escrevendo arquivo...` : 
                    name === "execute_command" ? `Executando comando...` :
                    `Listando diretório...`
                  );
                  try {
                    let endpoint = '';
                    let body = {};
                    if (name === "read_file") { endpoint = '/api/fs/read'; body = { filePath: args.filePath }; }
                    else if (name === "write_file") { endpoint = '/api/fs/write'; body = { filePath: args.filePath, content: args.content }; }
                    else if (name === "list_directory") { endpoint = '/api/fs/list'; body = { dirPath: args.dirPath }; }
                    else if (name === "execute_command") { endpoint = '/api/fs/exec'; body = { command: args.command }; }

                    const res = await fetch(endpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body)
                    });
                    const data = await res.json();
                    
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ 
                        functionResponses: [{
                          name,
                          id: call.id,
                          response: data.error ? { success: false, error: data.error } : { success: true, ...data }
                        }]
                      });
                    });
                  } catch (err: any) {
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ functionResponses: [{ name, id: call.id, response: { success: false, error: err.message } }] });
                    });
                  }

                // === 📱 IMPLEMENTAÇÃO: WHATSAPP ===
                } else if (name === "whatsapp_send") {
                  handled = true;
                  setCurrentTask(`Enviando WhatsApp...`);
                  try {
                    const res = await fetch('/api/whatsapp/send', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(args)
                    });
                    const data = await res.json();
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ 
                        functionResponses: [{
                          name,
                          id: call.id,
                          response: data
                        }]
                      });
                    });
                  } catch (err: any) {
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ functionResponses: [{ name, id: call.id, response: { success: false, error: err.message } }] });
                    });
                  }

                // === 🏠 IMPLEMENTAÇÃO: ALEXA ===
                } else if (name === "alexa_command") {
                  handled = true;
                  setCurrentTask(`Executando comando Alexa...`);
                  try {
                    const res = await fetch('/api/alexa/command', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(args)
                    });
                    const data = await res.json();
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ 
                        functionResponses: [{
                          name,
                          id: call.id,
                          response: data
                        }]
                      });
                    });
                  } catch (err: any) {
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ functionResponses: [{ name, id: call.id, response: { success: false, error: err.message } }] });
                    });
                  }

                // === 📖 IMPLEMENTAÇÃO: LEITURA DE URL ===
                } else if (name === "read_url_content") {
                  handled = true;
                  setCurrentTask(`Lendo página web...`);
                  try {
                    const url = args.url as string;
                    
                    responses.push({ 
                      name, 
                      id: call.id, 
                      response: { 
                        success: true, 
                        status: "reading",
                        message: `📖 Lendo conteúdo de ${url}...` 
                      } 
                    });
                    
                    const content = await readUrlContent(url);
                    
                    sessionPromise.then((session: any) => {
                      session.sendToolResponse({ 
                        functionResponses: [{
                          name,
                          id: call.id,
                          response: { 
                            success: true, 
                            content: content,
                            url: url
                          }
                        }]
                      });
                    });
                    
                    onToolCallRef.current?.(name, args);
                    
                  } catch (err: any) {
                    console.error('Erro na tool read_url_content:', err);
                    responses.push({ 
                      name, 
                      id: call.id, 
                      response: { 
                        success: false, 
                        error: `Erro ao ler URL: ${err.message || 'Erro desconhecido'}` 
                      } 
                    });
                  }
                  
                // === 🎨 IMPLEMENTAÇÃO: GERAÇÃO DE IMAGEM ===
                } else if (name === "generate_image") {
                  handled = true;
                  setCurrentTask(`Gerando imagem...`);
                  try {
                    const prompt = args.prompt as string;
                    const aspectRatio = args.aspect_ratio as any || "1:1";
                    
                    responses.push({ 
                      name, 
                      id: call.id, 
                      response: { 
                        success: true, 
                        status: "generating",
                        message: `🎨 Gerando imagem para "${prompt}"...` 
                      } 
                    });
                    
                    // Executa a geração de imagem de forma assíncrona
                    generateImage(prompt, aspectRatio).then(() => {
                      sessionPromise.then((session: any) => {
                        session.sendToolResponse({ 
                          functionResponses: [{
                            name,
                            id: call.id,
                            response: { 
                              success: true, 
                              message: `Imagem gerada com sucesso para: ${prompt}`,
                              prompt: prompt
                            }
                          }]
                        });
                      });
                    }).catch((err) => {
                      console.error('Erro na geração de imagem assíncrona:', err);
                      sessionPromise.then((session: any) => {
                        session.sendToolResponse({ 
                          functionResponses: [{
                            name,
                            id: call.id,
                            response: { 
                              success: false, 
                              error: `Erro na geração: ${err.message || 'Erro desconhecido'}` 
                            }
                          }]
                        });
                      });
                    });
                    
                    onToolCallRef.current?.(name, args);
                    
                  } catch (err: any) {
                    console.error('Erro na tool generate_image:', err);
                    responses.push({ 
                      name, 
                      id: call.id, 
                      response: { 
                        success: false, 
                        error: `Erro na geração: ${err.message || 'Erro desconhecido'}` 
                      } 
                    });
                  }
                } else if (name === "toggle_screen_sharing") {
                  setCurrentTask(`Alterando tela...`);
                  onToggleScreenSharingRef.current?.(args.enabled as boolean);
                  responses.push({ name, id: call.id, response: { success: true, message: `Compartilhamento de tela ${args.enabled ? 'ativado' : 'desativado'}.` } });
                  handled = true;
                } else if (name === "open_url") {
                  setCurrentTask(`Abrindo URL...`);
                  onOpenUrlRef.current?.(args.url as string);
                  responses.push({ name, id: call.id, response: { success: true, message: `Abrindo URL: ${args.url}` } });
                  handled = true;
                } else if (name === "change_voice") {
                  setCurrentTask(`Mudando voz...`);
                  onChangeVoiceRef.current?.(args.voice_name as VoiceName);
                  responses.push({ name, id: call.id, response: { success: true, message: `Voz alterada para ${args.voice_name}.` } });
                  handled = true;
                } else if (name === "interact_with_screen") {
                  setCurrentTask(`Interagindo...`);
                  onInteractRef.current?.(args.action, args.x, args.y, args.text);
                  responses.push({ name, id: call.id, response: { success: true } });
                  handled = true;
                } else if (name === "mascot_control") {
                  setCurrentTask(`Controlando mascote...`);
                  setMascotAction(args.action === 'click' ? 'clicking' : 'pointing');
                  setMascotTarget(args.target);
                  responses.push({ name, id: call.id, response: { success: true } });
                  handled = true;
                } else if (name === "complete_onboarding") {
                  setCurrentTask(`Finalizando setup...`);
                  setOnboardingStep('completed');
                  responses.push({ name, id: call.id, response: { success: true } });
                  handled = true;
                }

                if (!handled) {
                  setCurrentTask(null);
                  responses.push({ name, id: call.id, response: { success: false, error: "Ferramenta não implementada" } });
                }
              }
              
              const immediateResponses = responses.filter(r => 
                !['search_web', 'read_url_content', 'generate_image'].includes(r.name) || 
                (r.response?.status !== 'searching' && r.response?.status !== 'reading' && r.response?.status !== 'generating')
              );
              
              if (immediateResponses.length > 0) {
                sessionPromise.then(session => session.sendToolResponse({ functionResponses: immediateResponses }));
              }
              // Do not set isThinking to false here, wait for the model response
            }

            if (message.serverContent?.interrupted) {
              setCurrentTask(null);
              audioQueue.current = [];
              activeSourcesRef.current.forEach(source => {
                try { source.stop(); } catch (e) {}
              });
              activeSourcesRef.current = [];
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            console.log("Conexão Live API fechada.");
            setIsConnected(false);
            isConnectedRef.current = false;
            sessionRef.current = null;
            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
            stopAudio(true);
          },
          onerror: (err: any) => {
            if (err.message?.includes("aborted") || err.message?.includes("Aborted")) {
              console.warn("Live API connection was aborted.");
              return;
            }
            console.error("Live API Error Details:", err);
            let errorMsg = `Erro na API Live: ${err.message || 'Erro desconhecido'}`;
            if (err.message?.includes("429") || err.message?.includes("Quota Exceeded")) {
              errorMsg = "O OS está em cooldown de tokens. Aguarde 60 segundos.";
            }
            setError(errorMsg);
            setIsConnected(false);
            isConnectedRef.current = false;
            sessionRef.current = null;
            if (connectionTimerRef.current) clearTimeout(connectionTimerRef.current);
            stopAudio(true);
          }
        }
      });

      sessionRef.current = sessionPromise;
      await sessionPromise;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } 
      });
      streamRef.current = stream;
      
      // ✅ FIX: Sempre cria um novo inputAudioContext (o antigo foi fechado no stopAudio)
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      inputAudioContextRef.current = inputCtx;
      inputWorkletLoadedRef.current = false; // novo contexto, precisa carregar o worklet

      const source = inputCtx.createMediaStreamSource(stream);

      // ✅ FIX: Só chama addModule no input context se ainda não foi carregado
      if (!inputWorkletLoadedRef.current) {
        await inputCtx.audioWorklet.addModule(url);
        inputWorkletLoadedRef.current = true;
      }

      const inputWorklet = new AudioWorkletNode(inputCtx, 'audio-processor');
      audioWorkletNodeRef.current = inputWorklet;
      source.connect(inputWorklet);

      let audioBuffer: Int16Array[] = [];
      let currentBufferSize = 0;
      const TARGET_BUFFER_SIZE = 1024;

      inputWorklet.port.onmessage = (event) => {
        const int16Data = event.data;
        if (int16Data.length > 0) {
          audioBuffer.push(int16Data);
          currentBufferSize += int16Data.length;
        }
        
        if (currentBufferSize >= TARGET_BUFFER_SIZE) {
          const combined = new Int16Array(currentBufferSize);
          let offset = 0;
          for (const chunk of audioBuffer) {
            combined.set(chunk, offset);
            offset += chunk.length;
          }
          let sum = 0;
          for (let i = 0; i < combined.length; i++) {
            sum += Math.abs(combined[i] / 0x7FFF);
          }
          const currentVolume = sum / combined.length;
          setVolume(currentVolume);
          
          const VAD_THRESHOLD = 0.0005;
          
          if (!isMutedRef.current && sessionRef.current && isConnectedRef.current && currentVolume > VAD_THRESHOLD && !isSpeakingRef.current && !isThinkingRef.current) {
            try {
              sessionRef.current.then((session: any) => {
                if (session && typeof session.sendRealtimeInput === 'function') {
                  session.sendRealtimeInput({ audio: { data: toBase64(combined.buffer), mimeType: 'audio/pcm;rate=16000' } });
                }
              });
            } catch (e) {
              console.error("Error sending audio:", e);
            }
          } else if (!isMutedRef.current && sessionRef.current && isConnectedRef.current && !isSpeaking && !isThinking) {
            try {
              sessionRef.current.then((session: any) => {
                if (session && typeof session.sendRealtimeInput === 'function') {
                  session.sendRealtimeInput({ audio: { data: toBase64(combined.buffer), mimeType: 'audio/pcm;rate=16000' } });
                }
              });
            } catch (e) {
              console.error("Error sending audio:", e);
            }
          }
          audioBuffer = [];
          currentBufferSize = 0;
        }
      };

    } catch (err: any) {
      if (err.message?.includes("aborted") || err.message?.includes("Aborted")) {
        console.warn("Connection attempt was aborted.");
        return;
      }
      console.error("Connection failed:", err);
      let errorMsg = err.message;
      if (err.message?.includes("429") || err.message?.includes("Quota Exceeded")) {
        errorMsg = "O OS está em cooldown de tokens. Aguarde 60 segundos.";
      }
      setError(errorMsg);
      setIsConnected(false);
      isConnectedRef.current = false;
    }
  }, [voice, stopAudio, playNextChunk, toBase64, setError, storedApiKey, setIsConnected, setIsListening, addMessage, setMascotAction, setMascotTarget, setOnboardingStep, setVolume, readUrlContent, systemInstruction]);

  const startScreenSharing = useCallback(async () => {
    try {
      const mediaDevices = navigator.mediaDevices as any;
      if (!mediaDevices) throw new Error("O navegador não suporta APIs de mídia.");
      
      const getDisplayMedia = mediaDevices.getDisplayMedia?.bind(mediaDevices) || (navigator as any).getDisplayMedia?.bind(navigator);
      if (!getDisplayMedia) throw new Error("O compartilhamento de tela não é suportado neste navegador (tente abrir em uma nova aba).");
      
      const stream = await getDisplayMedia({ video: true });
      screenStreamRef.current = stream;
      
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const sendFrame = async () => {
        if (!screenStreamRef.current || !sessionRef.current || !ctx) return;
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          sessionRef.current.then((session: any) => {
            session.sendRealtimeInput({ video: { data: base64, mimeType: 'image/jpeg' } });
          });
          if (screenStreamRef.current.active) setTimeout(sendFrame, 1000);
        } catch (e) {
          console.error("Frame capture error:", e);
        }
      };
      sendFrame();
    } catch (e: any) {
      console.error("Screen share error:", e);
      let msg = "Falha ao iniciar compartilhamento de tela";
      if (e.name === 'NotAllowedError') {
        msg = "Permissão negada pelo usuário ou bloqueada pelo navegador. Verifique se o compartilhamento de tela está permitido.";
      } else if (e.name === 'NotFoundError') {
        msg = "Nenhuma fonte de tela encontrada.";
      }
      setError(msg);
    }
  }, [setError]);

  const disconnect = useCallback((isReconnecting = false) => {
    if (sessionRef.current) {
      sessionRef.current.then((session: any) => session.close());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    stopAudio(isReconnecting);
  }, [stopAudio]);

  return {
    isConnected,
    isSpeaking,
    isListening,
    isThinking,
    volume,
    error,
    connect,
    disconnect,
    startScreenSharing,
    history,
    sendMessage,
    sendLiveMessage,
    sendFile,
    generateImage
  };
};
