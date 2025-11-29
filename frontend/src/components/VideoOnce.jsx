import { useEffect, useRef, useState, useMemo } from 'react'

export default function VideoOnce({ src, storageKey, onEnded, coverText = 'Dale click al video — esta oportunidad en unas horas desaparecerá' }) {
  const videoRef = useRef(null)
  const iframeRef = useRef(null)
  const [played, setPlayed] = useState(false)
  // Mostrar el player desde el inicio para autoplay (muted)
  const [showOverlay, setShowOverlay] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [needStart, setNeedStart] = useState(false)
  const [autoTried, setAutoTried] = useState(false)
  // Fallback: si el player no reporta preparación en unos segundos, ofrecer abrir en origen
  const [loadTimedOut, setLoadTimedOut] = useState(false)
  const isYouTube = useMemo(() => /youtube\.com|youtu\.be/.test(String(src || '')), [src])
  const isVimeo = useMemo(() => /vimeo\.com/.test(String(src || '')), [src])
  const youtubeEmbedUrl = useMemo(() => {
    if (!isYouTube) return null
    try {
      const u = new URL(src)
      const host = u.hostname.replace(/^www\./, '')
      let id = ''
      // youtu.be/<id>
      if (host.includes('youtu.be')) {
        id = u.pathname.replace('/', '')
      } else if (host.includes('youtube.com')) {
        const path = u.pathname || ''
        // /watch?v=<id>
        id = u.searchParams.get('v') || ''
        // /shorts/<id>
        if (!id && /\/shorts\//.test(path)) id = path.split('/shorts/')[1]?.split('/')[0] || ''
        // /embed/<id>
        if (!id && /\/embed\//.test(path)) id = path.split('/embed/')[1]?.split('/')[0] || ''
        // /live/<id>
        if (!id && /\/live\//.test(path)) id = path.split('/live/')[1]?.split('/')[0] || ''
      }
      if (!id) return null
      // Autoplay muted para cumplir políticas; sonido se activa vía clic
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const params = new URLSearchParams({
        autoplay: '1',
        mute: '0',
        modestbranding: '1',
        rel: '0',
        playsinline: '1',
        controls: '1',
        fs: '1',
        iv_load_policy: '3',
        enablejsapi: '1',
        origin
      })
      // Usar dominio sin cookies para reducir overlays y rastreo
      return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
    } catch {
      return null
    }
  }, [isYouTube, src])

  const vimeoEmbedUrl = useMemo(() => {
    if (!isVimeo) return null
    try {
      const u = new URL(src)
      const host = u.hostname.replace(/^www\./, '')
      let id = ''
      // player.vimeo.com/video/<id>
      if (host.includes('player.vimeo.com')) {
        if (/\/video\//.test(u.pathname)) id = u.pathname.split('/video/')[1]?.split('/')[0] || ''
      } else if (host.includes('vimeo.com')) {
        const parts = u.pathname.split('/').filter(Boolean)
        for (let i = parts.length - 1; i >= 0; i--) {
          if (/^\d+$/.test(parts[i])) { id = parts[i]; break }
        }
      }
      if (!id) return null
      // Autoplay muted para cumplir políticas; luego activaremos sonido vía API con clic
      const params = new URLSearchParams({ autoplay: '1', muted: '0', title: '0', byline: '0', portrait: '0', playsinline: '1', controls: '0' })
      return `https://player.vimeo.com/video/${id}?${params.toString()}`
    } catch {
      return null
    }
  }, [isVimeo, src])

  useEffect(() => {
    const hasPlayed = localStorage.getItem(storageKey) === '1'
    if (hasPlayed) setPlayed(true)
  }, [storageKey])

  useEffect(() => {
    if (played) setShowOverlay(false)
  }, [played])

  useEffect(() => {
    if (!played && videoRef.current && !isYouTube && !isVimeo) {
      const v = videoRef.current
      const handleEnded = () => {
        localStorage.setItem(storageKey, '1')
        setPlayed(true)
        try { if (typeof onEnded === 'function') onEnded() } catch {}
      }
      v.addEventListener('ended', handleEnded)
      return () => v.removeEventListener('ended', handleEnded)
  }
  }, [played, storageKey, isYouTube, isVimeo])

  // Detectar "ready" del iframe (YouTube/Vimeo) para iniciar con volumen tras el gesto
  useEffect(() => {
    if (!isYouTube && !isVimeo) return
    const onMsg = (ev) => {
      try {
        const o = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        const origin = String(ev.origin || '')
        const isYT = /youtube\./.test(origin) || /youtu\.be/.test(origin)
        const isVM = /vimeo\./.test(origin)
        if (isYT && o?.event === 'onReady') setPlayerReady(true)
        if (isVM && (o?.event === 'ready' || o?.method === 'ready')) setPlayerReady(true)
      } catch {}
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [isYouTube, isVimeo])

  // Temporizador para mostrar botón de abrir en origen si el player tarda
  useEffect(() => {
    if (!isYouTube && !isVimeo) return
    setLoadTimedOut(false)
    const id = setTimeout(() => setLoadTimedOut(true), 5000)
    return () => clearTimeout(id)
  }, [src, isYouTube, isVimeo])

  const attemptStart = () => {
    try {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      if (isYouTube) {
        win.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*')
        win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }), '*')
        win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*')
      } else if (isVimeo) {
        win.postMessage(JSON.stringify({ method: 'setVolume', value: 1 }), '*')
        win.postMessage(JSON.stringify({ method: 'play' }), '*')
      }
    } catch {}
  }

  // Autoplay en silencio: iniciar reproducción sin sonido cuando el player esté listo
  const attemptAutoMuted = () => {
    try {
      const win = iframeRef.current?.contentWindow
      if (!win) return
      if (isYouTube) {
        win.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*')
        win.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [0] }), '*')
        win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*')
      } else if (isVimeo) {
        win.postMessage(JSON.stringify({ method: 'setVolume', value: 0 }), '*')
        win.postMessage(JSON.stringify({ method: 'play' }), '*')
      }
    } catch {}
  }

  const markPlayed = () => {
    localStorage.setItem(storageKey, '1')
    setPlayed(true)
    try { if (typeof onEnded === 'function') onEnded() } catch {}
  }

  const handleOverlayClick = () => {
    // Registrar intención de activar sonido y reproducir
    setNeedStart(true)
    setShowOverlay(false)
    // HTML5: quitar mute y reproducir
    setTimeout(() => {
      try {
        if (videoRef.current) {
          videoRef.current.muted = false
          videoRef.current.play?.()
        }
      } catch {}
    }, 0)
    // YouTube/Vimeo: intentar inmediato y reintento si aún no listo
    setTimeout(() => attemptStart(), 200)
  }

  // Cuando el player queda listo y el usuario ya hizo clic, iniciar con volumen
  useEffect(() => {
    if (playerReady && needStart) {
      attemptStart()
      // reiniciar flags para no spamear
      setNeedStart(false)
    }
  }, [playerReady, needStart])
  
  // Cuando el player queda listo, intentar autoplay con sonido automáticamente
  useEffect(() => {
    if (playerReady && !autoTried) {
      attemptStart()
      setAutoTried(true)
    }
  }, [playerReady, autoTried])

  if (played) {
    return (
      <div className="rounded-xl bg-gray-100 p-6 text-center text-gray-600">
        <p>El video ya se reprodujo una vez. Continúa con tu registro.</p>
      </div>
    )
  }

  if (!showOverlay && ((isYouTube && youtubeEmbedUrl) || (isVimeo && vimeoEmbedUrl))) {
    return (
      <div className="relative">
        <div className="aspect-video rounded-xl overflow-hidden shadow relative">
          <iframe
            src={youtubeEmbedUrl || vimeoEmbedUrl}
            title="Video"
            className="w-full h-full"
            frameBorder="0"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            ref={iframeRef}
            tabIndex={-1}
          />
          {/* Capa para bloquear clics en el iframe y evitar overlays como "Compartir" */}
          <div
            className="absolute inset-0 cursor-default"
            onClick={(e)=> { e.preventDefault(); handleOverlayClick() }}
            onContextMenu={(e)=> e.preventDefault()}
            aria-hidden="true"
          />
          {/* Fallback visible para abrir en origen si el player tarda o aparece verificación */}
          {(!playerReady && loadTimedOut) && (
            <div className="absolute bottom-2 right-2">
              <a href={src} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Abrir en {isYouTube ? 'YouTube' : 'Vimeo'}</a>
            </div>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <button className="btn btn-outline btn-sm" onClick={markPlayed}>Marcar como visto</button>
        </div>
      </div>
    )
  }

  // Fallback para enlaces de YouTube no reconocidos
  if (isYouTube && !youtubeEmbedUrl) {
    return (
      <div className="rounded-xl bg-black/50 border border-white/20 p-4 text-sm text-gray-200">
        <p>El enlace de YouTube no es reproducible directamente. Usa un enlace como:</p>
        <ul className="list-disc ml-5 mt-2">
          <li>https://www.youtube.com/watch?v=ID</li>
          <li>https://youtu.be/ID</li>
          <li>https://www.youtube.com/shorts/ID</li>
        </ul>
        <div className="mt-3">
          <a href={src} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Abrir en YouTube</a>
        </div>
      </div>
    )
  }

  // Fallback para enlaces de Vimeo no reconocidos
  if (isVimeo && !vimeoEmbedUrl) {
    return (
      <div className="rounded-xl bg-black/50 border border-white/20 p-4 text-sm text-gray-200">
        <p>El enlace de Vimeo no es reproducible directamente. Usa un enlace como:</p>
        <ul className="list-disc ml-5 mt-2">
          <li>https://vimeo.com/ID</li>
          <li>https://player.vimeo.com/video/ID</li>
        </ul>
        <div className="mt-3">
          <a href={src} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">Abrir en Vimeo</a>
        </div>
      </div>
    )
  }

  // Portada clicable (se muestra cuando showOverlay=true y aún no reproducido)
  // Portada clicable (se muestra cuando showOverlay=true y aún no reproducido)
  if (showOverlay) {
    return (
      <div className="relative rounded-xl overflow-hidden">
        <div className="aspect-video bg-black/60 border border-white/20 flex items-center justify-center">
          <div className="text-center px-6">
            <button onClick={handleOverlayClick} className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition">
              <span className="ml-1">▶</span>
            </button>
            <p className="text-sm sm:text-base text-white font-medium">{coverText}</p>
            <p className="text-xs text-gray-300 mt-1">Haz clic para reproducir con sonido</p>
          </div>
        </div>
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
        onClick={() => {
          try {
            videoRef.current.muted = false
            videoRef.current.play?.()
          } catch {}
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-black/5" />
    </div>
  )
}