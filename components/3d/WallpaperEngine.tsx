
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Vector2 } from 'three';
import * as THREE from 'three';
import { useSettingsStore } from '../../stores/settingsStore';

const VertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FragmentShader = `
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
varying vec2 vUv;

// Simple noise function
float random (in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);
}

float noise (in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  vec2 uv = vUv;
  float t = uTime * 0.1;
  
  // Interaction with mouse
  float dist = distance(uv, uMouse);
  float mouseEffect = smoothstep(0.4, 0.0, dist) * 0.2;
  
  vec2 grid = uv * 3.0;
  float n = noise(grid + vec2(t, t));
  
  // Fluid-like color mix
  vec3 colorA = vec3(0.05, 0.09, 0.16); // Slate 900
  vec3 colorB = vec3(0.2, 0.1, 0.4);    // Deep Purple
  vec3 colorC = vec3(0.0, 0.4, 0.4);    // Cyan accent
  
  vec3 finalColor = mix(colorA, colorB, n + mouseEffect);
  finalColor = mix(finalColor, colorC, pow(n, 3.0) * 0.5);
  
  // Scanline effect
  float scanline = sin(uv.y * 200.0 + t * 10.0) * 0.02;
  
  gl_FragColor = vec4(finalColor + scanline, 1.0);
}
`;

const ShaderPlane = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uResolution: { value: new Vector2(window.innerWidth, window.innerHeight) }
    }),
    []
  );

  useFrame((state) => {
    if (meshRef.current) {
      const { clock, pointer } = state;
      const shaderMaterial = meshRef.current.material as THREE.ShaderMaterial;
      // Use shader material uniforms
      shaderMaterial.uniforms.uTime.value = clock.getElapsedTime();
      
      // Interpolate mouse position for smoothness
      const currentX = shaderMaterial.uniforms.uMouse.value.x;
      const currentY = shaderMaterial.uniforms.uMouse.value.y;
      
      // Pointer is -1 to 1, map to 0 to 1
      const targetX = (pointer.x + 1) / 2;
      const targetY = (pointer.y + 1) / 2;

      shaderMaterial.uniforms.uMouse.value.x = THREE.MathUtils.lerp(currentX, targetX, 0.05);
      shaderMaterial.uniforms.uMouse.value.y = THREE.MathUtils.lerp(currentY, targetY, 0.05);
      shaderMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    }
  });

  return (
    <mesh ref={meshRef} scale={[10, 10, 1]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VertexShader}
        fragmentShader={FragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};

export const WallpaperEngine = () => {
  const { reducedMotion } = useSettingsStore();
  const [maxDpr, setMaxDpr] = useState(1.5);

  useEffect(() => {
    const updateDpr = () => {
      const dpr = window.devicePixelRatio || 1;
      const capped = reducedMotion ? 1.25 : 1.75;
      setMaxDpr(Math.max(1, Math.min(capped, dpr)));
    };

    updateDpr();
    window.addEventListener('resize', updateDpr);
    return () => window.removeEventListener('resize', updateDpr);
  }, [reducedMotion]);

  return (
    <div className="absolute inset-0 -z-50">
      <Canvas 
        camera={{ position: [0, 0, 1] }} 
        dpr={[1, maxDpr]}
        gl={{ powerPreference: "low-power", alpha: false, antialias: true }}
      >
        <ShaderPlane />
      </Canvas>
    </div>
  );
};

export default WallpaperEngine;
