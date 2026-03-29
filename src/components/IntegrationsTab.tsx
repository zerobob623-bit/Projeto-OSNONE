import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, MessageSquare, Music, Home, Power, RefreshCw, CheckCircle, XCircle, Loader2, LogIn, List } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const IntegrationsTab: React.FC = () => {
  const { 
    whatsappStatus, setWhatsappStatus,
    whatsappQr, setWhatsappQr,
    alexaStatus, setAlexaStatus,
    alexaDevices, setAlexaDevices
  } = useAppStore();

  const [alexaEmail, setAlexaEmail] = useState('');
  const [alexaPassword, setAlexaPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Fetch statuses on mount
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const waRes = await fetch('/api/whatsapp/status');
        const waData = await waRes.json();
        setWhatsappStatus(waData.status);

        if (waData.status === 'qr') {
          const qrRes = await fetch('/api/whatsapp/qr');
          const qrData = await qrRes.json();
          setWhatsappQr(qrData.qr);
        }

        const alexaRes = await fetch('/api/alexa/status');
        const alexaData = await alexaRes.json();
        setAlexaStatus(alexaData.status);

        if (alexaData.status === 'connected') {
          const devicesRes = await fetch('/api/alexa/devices');
          const devicesData = await devicesRes.json();
          setAlexaDevices(devicesData.devices || []);
        }
      } catch (err) {
        console.error('Error fetching integration statuses:', err);
      }
    };

    fetchStatuses();
    const interval = setInterval(fetchStatuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAlexaLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/alexa/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: alexaEmail, password: alexaPassword })
      });
      if (res.ok) {
        setAlexaStatus('connecting');
      }
    } catch (err) {
      console.error('Alexa login error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="space-y-8 p-4">
      {/* WhatsApp Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-green-500/20 flex items-center justify-center text-green-500">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-sm font-medium">WhatsApp</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Integração Baileys</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {whatsappStatus === 'connected' ? (
              <span className="flex items-center gap-1 text-[10px] text-green-500 uppercase tracking-widest font-medium">
                <CheckCircle size={12} /> Conectado
              </span>
            ) : whatsappStatus === 'qr' ? (
              <span className="flex items-center gap-1 text-[10px] text-yellow-500 uppercase tracking-widest font-medium">
                <RefreshCw size={12} className="animate-spin" /> Aguardando QR
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-white/20 uppercase tracking-widest font-medium">
                <XCircle size={12} /> Desconectado
              </span>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {whatsappStatus === 'qr' && whatsappQr && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4"
            >
              <p className="text-[10px] text-white/60 uppercase tracking-widest text-center">
                Escaneie o código abaixo no seu WhatsApp
              </p>
              <img src={whatsappQr} alt="WhatsApp QR Code" className="w-48 h-48 rounded-2xl border-4 border-white" />
              <p className="text-[9px] text-white/30 text-center max-w-[200px]">
                Vá em Configurações {'>'} Aparelhos Conectados {'>'} Conectar um aparelho
              </p>
            </motion.div>
          )}

          {whatsappStatus === 'connected' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Smartphone size={16} className="text-green-500" />
                <span className="text-xs text-green-500/80">Sua conta está vinculada e pronta para uso.</span>
              </div>
              <button className="p-2 rounded-xl bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-all">
                <Power size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <div className="h-px bg-white/5" />

      {/* Alexa Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500">
              <Home size={20} />
            </div>
            <div>
              <h3 className="text-sm font-medium">Amazon Alexa</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Automação Local</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {alexaStatus === 'connected' ? (
              <span className="flex items-center gap-1 text-[10px] text-blue-500 uppercase tracking-widest font-medium">
                <CheckCircle size={12} /> Conectado
              </span>
            ) : alexaStatus === 'connecting' ? (
              <span className="flex items-center gap-1 text-[10px] text-blue-400 uppercase tracking-widest font-medium">
                <Loader2 size={12} className="animate-spin" /> Conectando...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-white/20 uppercase tracking-widest font-medium">
                <XCircle size={12} /> Desconectado
              </span>
            )}
          </div>
        </div>

        {alexaStatus === 'disconnected' || alexaStatus === 'error' ? (
          <form onSubmit={handleAlexaLogin} className="space-y-3 p-4 rounded-3xl bg-white/5 border border-white/10">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-white/40 ml-2">E-mail Amazon</label>
              <input 
                type="email" 
                value={alexaEmail}
                onChange={(e) => setAlexaEmail(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500/50 transition-all"
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-white/40 ml-2">Senha</label>
              <input 
                type="password" 
                value={alexaPassword}
                onChange={(e) => setAlexaPassword(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-xs focus:outline-none focus:border-blue-500/50 transition-all"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-500 text-white rounded-2xl py-3 text-xs font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-all disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
              Conectar Alexa
            </button>
            {alexaStatus === 'error' && (
              <p className="text-[9px] text-red-400 text-center uppercase tracking-widest">Erro na autenticação. Verifique os dados.</p>
            )}
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <h4 className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-2">
                <List size={12} /> Dispositivos Encontrados
              </h4>
              <span className="text-[10px] text-blue-500 font-medium">{alexaDevices.length}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {alexaDevices.map((device: any) => (
                <div key={device.accountName} className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500/50">
                      <Music size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{device.accountName}</p>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest">{device.deviceType}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${device.online ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_8px_rgba(34,197,94,0.5)]`} />
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
