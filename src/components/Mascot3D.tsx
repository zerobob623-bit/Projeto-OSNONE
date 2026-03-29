import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { Canvas } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { Mascot3DModel } from './Mascot3DModel';

interface MascotProps {
  onToggleVoice?: () => void;
}

export const Mascot3D: React.FC<MascotProps> = ({ onToggleVoice }) => {
  const { isMascotVisible, mascotTarget, setMascotTarget, mascotAction, setMascotAction, mascotAppearance, isHimMode } = useAppStore();
  const [position, setPosition] = useState({ x: window.innerWidth - 120, y: window.innerHeight - 120 });
  const [isPointing, setIsPointing] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  const mascotRef = useRef<HTMLDivElement>(null);

  const handleMascotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleVoice) {
      onToggleVoice();
      playClickSound();
    }
  };

  const playClickSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error('Error playing click sound:', e);
    }
  };

  useEffect(() => {
    if (mascotTarget) {
      let targetX = 0;
      let targetY = 0;

      // Check if target is coordinates (e.g., "x:500,y:300")
      if (mascotTarget.startsWith('x:')) {
        const coords = mascotTarget.split(',');
        targetX = parseInt(coords[0].split(':')[1]);
        targetY = parseInt(coords[1].split(':')[1]);
      } else {
        const targetElement = document.getElementById(mascotTarget);
        if (targetElement) {
          const rect = targetElement.getBoundingClientRect();
          targetX = rect.left + rect.width / 2;
          targetY = rect.top + rect.height / 2;
        }
      }

      if (targetX || targetY) {
        setIsRunning(true);
        setIsPointing(false);
        setIsClicking(false);
        
        // Move to the target
        setPosition({ x: targetX, y: targetY + 60 }); // Position slightly below
        
        const timer = setTimeout(() => {
          setIsRunning(false);
          
          if (mascotAction === 'clicking') {
            setIsClicking(true);
            playClickSound();
            
            // Trigger real click on the underlying element
            setTimeout(() => {
              try {
                if (mascotTarget.startsWith('x:')) {
                  const coords = mascotTarget.split(',');
                  const x = parseInt(coords[0].split(':')[1]);
                  const y = parseInt(coords[1].split(':')[1]);
                  // Temporarily hide mascot or ensure it has pointer-events-none (it already does)
                  const el = document.elementFromPoint(x, y);
                  if (el instanceof HTMLElement) {
                    el.click();
                    // Also try to focus if it's an input
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                      el.focus();
                    }
                  }
                } else {
                  const el = document.getElementById(mascotTarget);
                  if (el) {
                    el.click();
                    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                      el.focus();
                    }
                  }
                }
              } catch (e) {
                console.error('Error triggering real click:', e);
              }
            }, 100);

            // Simulate click visually
            setTimeout(() => {
              setIsClicking(false);
              setMascotAction('idle');
              setMascotTarget(null);
              // Return to corner
              setTimeout(() => {
                setPosition({ x: window.innerWidth - 120, y: window.innerHeight - 120 });
              }, 1000);
            }, 500);
          } else {
            setIsPointing(true);
            // Reset after pointing
            setTimeout(() => {
              setIsPointing(false);
              setMascotTarget(null);
              // Return to corner
              setTimeout(() => {
                setPosition({ x: window.innerWidth - 120, y: window.innerHeight - 120 });
              }, 2000);
            }, 3000);
          }
        }, 1000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [mascotTarget, mascotAction, setMascotTarget, setMascotAction]);

  if (!isMascotVisible) return null;

  return (
    <motion.div
      ref={mascotRef}
      initial={{ opacity: 0, scale: 0, y: 100 }}
      animate={{ 
        opacity: isMascotVisible ? 1 : 0,
        scale: isMascotVisible ? 1 : 0,
        x: position.x - 75, // Center the 150x150 container
        y: position.y - 75,
      }}
      transition={{ 
        type: "spring", 
        stiffness: 100, 
        damping: 20,
      }}
      className="fixed z-[9999] pointer-events-auto cursor-pointer"
      style={{ left: 0, top: 0, width: 150, height: 150 }}
      onClick={handleMascotClick}
    >
      <div className="w-full h-full relative">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <Environment preset="city" />
          <Mascot3DModel 
            isPointing={isPointing} 
            isClicking={isClicking} 
            isRunning={isRunning} 
            primaryColor={mascotAppearance.primaryColor}
            secondaryColor={mascotAppearance.secondaryColor}
            isHimMode={isHimMode}
          />
          <ContactShadows position={[0, -1.5, 0]} opacity={0.4} scale={5} blur={2} far={4} />
        </Canvas>

        {/* Speech Bubble / Indicator */}
        <AnimatePresence>
          {isPointing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-xl"
            >
              AQUI! ✨
            </motion.div>
          )}
          {isClicking && (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 2 }}
                exit={{ opacity: 0, scale: 3 }}
                transition={{ duration: 0.4 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-[#88d8d8] rounded-full pointer-events-none"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: 0.5, scale: 1.5 }}
                exit={{ opacity: 0, scale: 2.5 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#88d8d8]/30 rounded-full pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
