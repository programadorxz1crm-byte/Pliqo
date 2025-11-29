import { useEffect, useRef, useState } from 'react'

export default function VideoOnce({ src, storageKey, onEnded }) {
  const videoRef = useRef(null)
  const [played, setPlayed] = useState(false)

  useEffect(() => {
    const hasPlayed = localStorage.getItem(storageKey) === '1'
    if (hasPlayed) setPlayed(true)
  }, [storageKey])

  useEffect(() => {
    if (!played && videoRef.current) {
      const v = videoRef.current
      const handleEnded = () => {
        localStorage.setItem(storageKey, '1')
        setPlayed(true)
        try { if (typeof onEnded === 'function') onEnded() } catch {}
      }
      v.addEventListener('ended', handleEnded)
      return () => v.removeEventListener('ended', handleEnded)
  }
  }, [played, storageKey])

  if (played) {
    return (
      <div className="rounded-xl bg-gray-100 p-6 text-center text-gray-600">
        <p>El video ya se reprodujo una vez. Continúa con tu registro.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      <video
        ref={videoRef}
        src={src}
        className="w-full rounded-xl shadow"
        autoPlay
        muted
        playsInline
        controls={false}
      />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/5" />
    </div>
  )
}