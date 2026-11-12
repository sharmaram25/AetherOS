
import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- Fluid Silk Wave Shader ---
// A vertex shader that displaces a plane based on Perlin noise and Audio frequency
const VertexShader = `
uniform float uTime;
uniform float uAudio;
varying vec2 vUv;
varying float vElevation;

// Classic Perlin 3D Noise 
// (Simplified for performance)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 = v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

  // Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  //Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}

void main() {
  vUv = uv;
  vec3 pos = position;
  
  // Frequency impact
  float frequency = uAudio * 2.0; 
  
  // Create a flowing wave
  float noiseVal = snoise(vec3(pos.x * 1.5, pos.y * 1.5, uTime * 0.2));
  
  // Displace Z based on noise and audio
  float elevation = noiseVal * (0.5 + frequency);
  pos.z += elevation;
  
  vElevation = elevation;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FragmentShader = `
uniform float uAudio;
varying vec2 vUv;
varying float vElevation;

void main() {
  // Base color (Deep Purple/Blue)
  vec3 colorLow = vec3(0.1, 0.05, 0.2);
  vec3 colorHigh = vec3(0.4, 0.2, 0.8);
  
  // Mix based on elevation
  vec3 color = mix(colorLow, colorHigh, vElevation * 2.0 + 0.5);
  
  // Add an "energy line" based on audio intensity
  float alpha = 0.3 + (uAudio * 0.5);
  
  gl_FragColor = vec4(color, alpha);
}
`;

const SilkWave = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array>(null);
  
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudio: { value: 0 }
    }),
    []
  );

  useEffect(() => {
    // Audio Context Setup
    const setupAudio = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const context = new AudioContext();
            const source = context.createMediaStreamSource(stream);
            const analyser = context.createAnalyser();
            analyser.fftSize = 512;
            analyser.smoothingTimeConstant = 0.8;
            source.connect(analyser);
            
            analyserRef.current = analyser;
            dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        } catch (e) {
            console.warn("Visualizer: Audio input denied or unavailable.");
        }
    };
    setupAudio();
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      // Update Time
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime();
      
      // Update Audio
      if (analyserRef.current && dataArrayRef.current) {
          analyserRef.current.getByteFrequencyData(dataArrayRef.current);
          
          // Get average frequency for a "bass" hit
          let sum = 0;
          const lowerBounds = Math.floor(dataArrayRef.current.length * 0.1); // Low freqs
          for(let i = 0; i < lowerBounds; i++) {
              sum += dataArrayRef.current[i];
          }
          const avg = sum / lowerBounds;
          
          // Normalize 0-1
          const normalized = avg / 255;
          
          // Smooth transition
          const current = (meshRef.current.material as THREE.ShaderMaterial).uniforms.uAudio.value;
          (meshRef.current.material as THREE.ShaderMaterial).uniforms.uAudio.value = THREE.MathUtils.lerp(current, normalized, 0.1);
      }
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -2, 0]} rotation={[-Math.PI / 3, 0, 0]}>
      <planeGeometry args={[12, 6, 64, 64]} />
      <shaderMaterial
        vertexShader={VertexShader}
        fragmentShader={FragmentShader}
        uniforms={uniforms}
        transparent={true}
        wireframe={true} // Stylish wireframe look
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// --- Scene Container ---
export const DesktopWidgets = () => {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-60 mix-blend-screen">
       <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ alpha: true }}>
          <ambientLight intensity={0.5} />
          <SilkWave />
       </Canvas>
    </div>
  );
};

export default DesktopWidgets;
