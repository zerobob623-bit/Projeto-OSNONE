import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface Node {
  x: number;
  y: number;
  active: number;
  color: string;
}

interface Connection {
  from: number;
  to: number;
  weight: number;
}

export const NeuralBrainView: React.FC<{ isThinking: boolean; volume: number }> = ({ isThinking, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    // Initialize nodes
    const newNodes: Node[] = [];
    const layers = [4, 8, 16, 6];
    const spacingX = 60;
    const spacingY = 30;

    layers.forEach((count, layerIdx) => {
      for (let i = 0; i < count; i++) {
        newNodes.push({
          x: layerIdx * spacingX + 20,
          y: i * spacingY + (16 - count) * (spacingY / 2) + 20,
          active: 0,
          color: '#e07a5f'
        });
      }
    });

    // Initialize connections
    const newConnections: Connection[] = [];
    let nodeOffset = 0;
    for (let l = 0; l < layers.length - 1; l++) {
      const currentLayerCount = layers[l];
      const nextLayerCount = layers[l + 1];
      const nextLayerOffset = nodeOffset + currentLayerCount;

      for (let i = 0; i < currentLayerCount; i++) {
        for (let j = 0; j < nextLayerCount; j++) {
          if (Math.random() > 0.7) { // Sparse connections for visual clarity
            newConnections.push({
              from: nodeOffset + i,
              to: nextLayerOffset + j,
              weight: Math.random()
            });
          }
        }
      }
      nodeOffset += currentLayerCount;
    }

    setNodes(newNodes);
    setConnections(newConnections);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw connections
      connections.forEach(conn => {
        const from = nodes[conn.from];
        const to = nodes[conn.to];
        if (!from || !to) return;

        const opacity = isThinking ? 0.2 + Math.random() * 0.3 : 0.1;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.strokeStyle = `rgba(224, 122, 95, ${opacity * conn.weight})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      });

      // Draw nodes
      nodes.forEach((node, idx) => {
        const pulse = isThinking ? Math.sin(Date.now() / 200 + idx) * 2 : 0;
        const size = 2 + pulse + (volume * 5);
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
        ctx.fillStyle = isThinking ? '#e07a5f' : 'rgba(224, 122, 95, 0.5)';
        ctx.fill();

        if (isThinking && Math.random() > 0.95) {
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#e07a5f';
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      });

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [nodes, connections, isThinking, volume]);

  return (
    <div className="relative w-[280px] h-[500px] flex items-center justify-center overflow-hidden pointer-events-none opacity-40">
      <canvas 
        ref={canvasRef} 
        width={280} 
        height={500}
        className="w-full h-full"
      />
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-accent/60">
          {isThinking ? 'Neural Processing...' : 'Neural Engine Idle'}
        </span>
      </div>
    </div>
  );
};
