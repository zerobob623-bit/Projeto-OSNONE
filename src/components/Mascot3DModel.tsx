import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Cylinder, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface Mascot3DModelProps {
  isPointing: boolean;
  isClicking: boolean;
  isRunning: boolean;
  primaryColor: string;
  secondaryColor: string;
  isHimMode?: boolean;
}

export const Mascot3DModel: React.FC<Mascot3DModelProps> = ({ isPointing, isClicking, isRunning, primaryColor, secondaryColor, isHimMode }) => {
  const groupRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;

    // Idle floating animation
    if (!isRunning) {
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
      if (isHimMode) {
        groupRef.current.rotation.y += 0.01;
      }
    } else {
      // Running/moving animation (wobble)
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 15) * 0.1;
      groupRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.2;
    }

    // Arm animations
    if (rightArmRef.current && leftArmRef.current && !isHimMode) {
      if (isPointing) {
        // Point right arm forward/up
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, -Math.PI / 2.5, 0.1);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, 0, 0.1);
      } else if (isClicking) {
        // Quick click motion
        const clickPhase = Math.sin(state.clock.elapsedTime * 30);
        rightArmRef.current.rotation.x = -Math.PI / 2.5 + clickPhase * 0.2;
      } else {
        // Idle arms
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, 0, 0.1);
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, Math.PI / 8, 0.1);
      }
      
      // Left arm stays idle
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, 0, 0.1);
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, -Math.PI / 8, 0.1);
    }
  });

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2, metalness: 0.1 });
  const screenMaterial = new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.1, metalness: 0.8 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: primaryColor, roughness: 0.3, metalness: 0.1 }); // Light blue/teal
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: secondaryColor }); // Glowing blue
  const himMaterial = new THREE.MeshStandardMaterial({ 
    color: '#3b82f6', 
    emissive: '#1d4ed8', 
    emissiveIntensity: 0.5,
    roughness: 0.1, 
    metalness: 0.8 
  });

  if (isHimMode) {
    return (
      <group ref={groupRef} position={[0, 0, 0]} scale={1.5}>
        <Sphere args={[1, 64, 64]}>
          <meshStandardMaterial 
            color="#3b82f6" 
            emissive="#1d4ed8" 
            emissiveIntensity={0.5} 
            roughness={0.1} 
            metalness={0.8} 
            wireframe
          />
        </Sphere>
        <Sphere args={[0.8, 64, 64]}>
          <meshStandardMaterial 
            color="#60a5fa" 
            emissive="#2563eb" 
            emissiveIntensity={1} 
            roughness={0} 
            metalness={1} 
          />
        </Sphere>
        <pointLight intensity={2} distance={5} color="#60a5fa" />
      </group>
    );
  }

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={1.5}>
      {/* Head */}
      <group position={[0, 0.8, 0]}>
        <Sphere args={[0.6, 32, 32]} material={bodyMaterial} />
        
        {/* Screen/Face */}
        <mesh position={[0, 0, 0.45]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.9, 0.7, 0.4]} />
          <primitive object={screenMaterial} attach="material" />
        </mesh>

        {/* Eyes */}
        <group position={[0, 0.05, 0.66]}>
          <mesh position={[-0.2, 0, 0]}>
            <circleGeometry args={[0.15, 32]} />
            <primitive object={eyeMaterial} attach="material" />
          </mesh>
          <mesh position={[0.2, 0, 0]}>
            <circleGeometry args={[0.15, 32]} />
            <primitive object={eyeMaterial} attach="material" />
          </mesh>
        </group>

        {/* Mouth (Cute 'w' shape using small capsules/cylinders) */}
        <group position={[0, -0.2, 0.66]} scale={0.5}>
          <mesh position={[-0.1, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <capsuleGeometry args={[0.03, 0.1, 8, 8]} />
            <primitive object={eyeMaterial} attach="material" />
          </mesh>
          <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
            <capsuleGeometry args={[0.03, 0.1, 8, 8]} />
            <primitive object={eyeMaterial} attach="material" />
          </mesh>
        </group>

        {/* Ear accents */}
        <mesh position={[-0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} />
          <primitive object={accentMaterial} attach="material" />
        </mesh>
        <mesh position={[0.58, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 32]} />
          <primitive object={accentMaterial} attach="material" />
        </mesh>
        
        {/* Top accent */}
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.05, 32]} />
          <primitive object={accentMaterial} attach="material" />
        </mesh>
      </group>

      {/* Neck Joint */}
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.1, 32]} />
        <primitive object={accentMaterial} attach="material" />
      </mesh>

      {/* Body */}
      <group position={[0, -0.3, 0]}>
        <Sphere args={[0.55, 32, 32]} material={bodyMaterial} />
        
        {/* Chest accent */}
        <mesh position={[0, 0.3, 0.45]} rotation={[0.2, 0, 0]}>
          <capsuleGeometry args={[0.15, 0.2, 16, 16]} />
          <primitive object={accentMaterial} attach="material" />
        </mesh>
      </group>

      {/* Right Arm */}
      <group ref={rightArmRef} position={[0.6, -0.1, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.15, 0.4, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
      </group>

      {/* Left Arm */}
      <group ref={leftArmRef} position={[-0.6, -0.1, 0]}>
        <mesh position={[0, -0.2, 0]}>
          <capsuleGeometry args={[0.15, 0.4, 16, 16]} />
          <primitive object={bodyMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
};
