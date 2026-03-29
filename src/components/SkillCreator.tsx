import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Save, Sparkles, Type, FileText, Zap } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface SkillCreatorProps {
  onClose: () => void;
}

export const SkillCreator: React.FC<SkillCreatorProps> = ({ onClose }) => {
  const { addSkill, moodColor } = useAppStore(state => ({
    addSkill: state.addSkill,
    moodColor: state.mood === 'happy' ? '#e07a5f' : 
               state.mood === 'calm' ? '#f4dcd3' : 
               state.mood === 'focused' ? '#8d3b2a' : 
               state.mood === 'playful' ? '#d4af37' : 
               state.mood === 'melancholic' ? '#636e72' : 
               state.mood === 'angry' ? '#8d3b2a' : '#d4af37'
  }));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [icon, setIcon] = useState('✨');

  const handleSave = () => {
    if (!name || !prompt) return;
    addSkill({
      name,
      description,
      prompt,
      icon,
      enabled: true
    });
    onClose();
  };

  const icons = ['✨', '🧠', '🎨', '🎵', '📝', '🔬', '🛡️', '🚀', '💬', '⚡'];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-6 space-y-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} style={{ color: moodColor }} />
          <h3 className="text-sm font-medium uppercase tracking-widest">Criar Nova Habilidade</h3>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest opacity-40 flex items-center gap-2">
            <Type size={12} /> Nome da Habilidade
          </label>
          <input 
            type="text" 
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Consultor de Vinhos"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest opacity-40 flex items-center gap-2">
            <FileText size={12} /> Descrição Curta
          </label>
          <input 
            type="text" 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Especialista em harmonização e safras"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest opacity-40 flex items-center gap-2">
            <Sparkles size={12} /> Instrução do Sistema (Prompt)
          </label>
          <textarea 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Você agora é um sommelier experiente. Sempre sugira vinhos que combinem com o prato mencionado..."
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-white/30 transition-all resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-widest opacity-40 block">Ícone</label>
          <div className="flex gap-2 flex-wrap">
            {icons.map(i => (
              <button 
                key={i} 
                onClick={() => setIcon(i)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${icon === i ? 'bg-white/20 border border-white/30' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button 
        onClick={handleSave}
        disabled={!name || !prompt}
        className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-[0.2em] font-medium transition-all disabled:opacity-30"
        style={{ backgroundColor: moodColor, color: 'white' }}
      >
        <Save size={16} /> Salvar Habilidade
      </button>
    </motion.div>
  );
};
