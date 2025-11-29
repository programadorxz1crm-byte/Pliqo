import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, Sparkles } from '@react-three/drei'
import { useRef } from 'react'

function StarField() {
  const g = useRef()
  useFrame((_, delta) => {
    if (!g.current) return
    g.current.rotation.y += 0.03 * delta
    g.current.rotation.x += 0.01 * delta
  })
  return (
    <group ref={g}>
      <Stars radius={90} depth={60} count={5000} factor={4} fade speed={0.7} />
    </group>
  )
}

function PassingLight({ color = '#8ab4ff', offset = 0, distance = 12 }) {
  const ref = useRef()
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime() * 0.6 + offset
    const x = -60 + ((t * 18) % 120)
    const y = Math.sin(t * 1.2) * 2
    const z = -20 + Math.cos(t) * 3
    if (ref.current) {
      ref.current.position.set(x, y, z)
      ref.current.rotation.y = Math.PI / 2
    }
  })
  return (
    <group ref={ref}>
      <mesh>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.5} />
      </mesh>
      <pointLight color={color} intensity={3} distance={distance} />
    </group>
  )
}

function Ship({ color = '#a5b4fc', speed = 0.5, offset = 0 }) {
  const ref = useRef()
  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + offset
    const x = -70 + ((t * 20) % 140)
    const y = Math.sin(t) * 1.8
    const z = -18 + Math.cos(t * 0.7) * 2.5
    if (ref.current) {
      ref.current.position.set(x, y, z)
      ref.current.rotation.y = Math.PI / 2
      ref.current.rotation.z = Math.sin(t * 1.5) * 0.2
    }
  })
  return (
    <group ref={ref}>
      <mesh>
        <coneGeometry args={[0.6, 1.6, 12]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.8, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1.2, 12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <pointLight intensity={3.5} color={color} position={[1.4, 0, 0]} distance={10} />
    </group>
  )
}

export default function SpaceBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 6], fov: 60 }}>
        <color attach="background" args={["#000"]} />
        <StarField />
        <Sparkles count={120} scale={60} size={1.5} speed={0.35} color="#a5b4fc" />
        <PassingLight color="#8ab4ff" offset={0.2} />
        <PassingLight color="#7dd3fc" offset={1.1} distance={14} />
        <PassingLight color="#c084fc" offset={2.4} distance={12} />
        <Ship color="#93c5fd" speed={0.6} offset={0.5} />
        <Ship color="#fca5a5" speed={0.45} offset={1.8} />
      </Canvas>
    </div>
  )
}