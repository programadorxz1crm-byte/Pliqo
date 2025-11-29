import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, ContactShadows, Stars, Sparkles } from '@react-three/drei'
import { useRef } from 'react'

function Robot({ position = [0, 0, 0] }) {
  return (
    <group position={position} castShadow receiveShadow>
      {/* cuerpo android */}
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.7, 1.3, 16, 24]} />
        <meshStandardMaterial color="#3DDC84" roughness={0.35} metalness={0.3} />
      </mesh>
      {/* cabeza con antenas */}
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#3DDC84" roughness={0.3} metalness={0.3} />
      </mesh>
      {/* antenas */}
      <mesh position={[-0.35, 2.2, 0.1]} rotation={[0, 0, 0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 12]} />
        <meshStandardMaterial color="#3DDC84" />
      </mesh>
      <mesh position={[0.35, 2.2, 0.1]} rotation={[0, 0, -0.6]}>
        <cylinderGeometry args={[0.03, 0.03, 0.35, 12]} />
        <meshStandardMaterial color="#3DDC84" />
      </mesh>
      {/* ojos luminosos */}
      <mesh position={[-0.18, 1.85, 0.42]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#a5b4fc" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.18, 1.85, 0.42]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#a5b4fc" emissiveIntensity={0.4} />
      </mesh>
      {/* brazos */}
      <mesh position={[-0.95, 1.1, 0]} rotation={[0, 0, 0.15]}>
        <cylinderGeometry args={[0.12, 0.12, 1.3, 16]} />
        <meshStandardMaterial color="#3DDC84" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0.95, 1.1, 0]} rotation={[0, 0, -0.15]}>
        <cylinderGeometry args={[0.12, 0.12, 1.3, 16]} />
        <meshStandardMaterial color="#3DDC84" roughness={0.35} metalness={0.3} />
      </mesh>
      {/* piernas */}
      <mesh position={[-0.35, -0.1, 0]}> 
        <cylinderGeometry args={[0.16, 0.16, 0.85, 16]} />
        <meshStandardMaterial color="#2bbd6b" roughness={0.35} metalness={0.25} />
      </mesh>
      <mesh position={[0.35, -0.1, 0]}> 
        <cylinderGeometry args={[0.16, 0.16, 0.85, 16]} />
        <meshStandardMaterial color="#2bbd6b" roughness={0.35} metalness={0.25} />
      </mesh>
    </group>
  )
}

function Phone({ position = [0.9, 1.1, 0.3] }) {
  return (
    <group position={position} rotation={[0.1, 0.2, -0.15]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.9, 0.06]} />
        <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.032]}> {/* pantalla */}
        <planeGeometry args={[0.46, 0.86]} />
        <meshStandardMaterial color="#1f6ef0" emissive="#358fff" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function MoneyStack({ position = [-0.8, 0.2, -0.2] }) {
  return (
    <group position={position}>
      {[0, 0.05, 0.1, 0.15].map((h, i) => (
        <mesh key={i} position={[0, h, 0]} castShadow>
          <boxGeometry args={[0.7, 0.02, 0.4]} />
          <meshStandardMaterial color="#16a34a" roughness={0.4} metalness={0.1} />
        </mesh>
      ))}
      {/* banda elástica */}
      <mesh position={[0, 0.075, 0]}>
        <torusGeometry args={[0.25, 0.02, 16, 64]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>
    </group>
  )
}

function ParallaxMotion({ targetRef }) {
  useFrame(({ mouse }) => {
    if (!targetRef.current) return
    targetRef.current.position.x = mouse.x * 0.2
    targetRef.current.position.y = mouse.y * 0.1
    targetRef.current.rotation.y += 0.002
  })
  return null
}

export default function Hero3D({ className }) {
  const groupRef = useRef()

  return (
    <div className={className} style={{ height: '420px', position: 'relative' }}>
      <Canvas camera={{ position: [3.2, 2.8, 3.2], fov: 50 }} shadows>
        <color attach="background" args={["#000"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
        <Stars radius={20} depth={40} count={1200} factor={4} fade speed={0.6} />
        <Sparkles count={60} scale={6} size={2} speed={0.5} color="#a5b4fc" />
        <group ref={groupRef} castShadow receiveShadow>
          <Robot />
          <Phone />
          <MoneyStack />
        </group>
        <ParallaxMotion targetRef={groupRef} />
        <ContactShadows position={[0, -1.6, 0]} opacity={0.5} scale={10} blur={2.8} far={1.6} />
        <Environment preset="studio" />
        <OrbitControls makeDefault enablePan={false} enableZoom={false} minDistance={5} maxDistance={5} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  )
}