import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import VideoOnce from '../components/VideoOnce.jsx'
import PaymentButtons from '../components/PaymentButtons.jsx'
import { api } from '../api.js'

const PLANS = [
  { id: '15', amount: 15 },
  { id: '37', amount: 37 },
  { id: '99', amount: 99 },
  { id: '187', amount: 187 },
  { id: '349', amount: 349 },
  { id: '987', amount: 987 },
]

export default function Landing() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const ref = params.get('ref')
  const whatsappParam = params.get('wa')
  const [geo, setGeo] = useState({ city: 'tu ciudad', country: '', ip: '' })
  const [sponsor, setSponsor] = useState({ name: 'Patrocinador', whatsappNumber: whatsappParam || '' })
  const fallbackEnvVideo = import.meta.env.VITE_LANDING_VIDEO_URL || ''
  const [videoUrl, setVideoUrl] = useState(fallbackEnvVideo || 'https://cdn.coverr.co/videos/coverr-people-are-walking-in-the-city-1080-5983.mp4')
  const [headline, setHeadline] = useState('')
  const [payment, setPayment] = useState(null)
  // Chat de comunidad (simulado)
  const [chatFeed, setChatFeed] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [showChatGate, setShowChatGate] = useState(false)
  const chatListRef = useRef(null)
  // Ubicaciones exclusivas para el chat de comunidad
  const LOCATIONS_CHAT = [
    { city: 'Buenos Aires', country: 'Argentina' },
    { city: 'Madrid', country: 'España' },
    { city: 'Ciudad de México', country: 'México' },
    { city: 'Bogotá', country: 'Colombia' },
    { city: 'Lima', country: 'Perú' },
    { city: 'Santiago', country: 'Chile' },
    { city: 'Miami', country: 'Estados Unidos' },
    { city: 'Toronto', country: 'Canadá' },
    { city: 'Quito', country: 'Ecuador' },
    { city: 'Montevideo', country: 'Uruguay' },
    { city: 'San José', country: 'Costa Rica' },
    { city: 'Santo Domingo', country: 'República Dominicana' },
  ]
  // Ubicaciones exclusivas para la notificación de compras (sin repetir países del chat)
  const LOCATIONS_TOAST = [
    { city: 'Asunción', country: 'Paraguay' },
    { city: 'La Paz', country: 'Bolivia' },
    { city: 'San Salvador', country: 'El Salvador' },
    { city: 'Panamá', country: 'Panamá' },
    { city: 'Managua', country: 'Nicaragua' },
    { city: 'Ciudad de Guatemala', country: 'Guatemala' },
    { city: 'Brasilia', country: 'Brasil' },
    { city: 'San Juan', country: 'Puerto Rico' },
  ]
  // Notificación flotante de compras
  const [toast, setToast] = useState({ text: '', key: 0 })
  const [toastVisible, setToastVisible] = useState(false)
  // Ejemplos realistas de compras para la notificación (nombres y países distintos del chat/testimonios)
  const PURCHASE_NOTICES = [
    { name: 'Rafael Almeida', city: LOCATIONS_TOAST[0].city, country: LOCATIONS_TOAST[0].country, plan: 99 },
    { name: 'Noelia Campos', city: LOCATIONS_TOAST[1].city, country: LOCATIONS_TOAST[1].country, plan: 37 },
    { name: 'Iván Montoya', city: LOCATIONS_TOAST[2].city, country: LOCATIONS_TOAST[2].country, plan: 187 },
    { name: 'Berta Aguilar', city: LOCATIONS_TOAST[3].city, country: LOCATIONS_TOAST[3].country, plan: 15 },
    { name: 'Fernando Quiroz', city: LOCATIONS_TOAST[4].city, country: LOCATIONS_TOAST[4].country, plan: 349 },
    { name: 'Yasmín Ortiz', city: LOCATIONS_TOAST[5].city, country: LOCATIONS_TOAST[5].country, plan: 99 },
    { name: 'Hugo Barrios', city: LOCATIONS_TOAST[6].city, country: LOCATIONS_TOAST[6].country, plan: 37 },
    { name: 'Luz Caballero', city: LOCATIONS_TOAST[7].city, country: LOCATIONS_TOAST[7].country, plan: 987 },
  ]
  const storageKey = useMemo(() => `landing_played_${ref || 'anon'}`,[ref])
  const visitKey = useMemo(() => `ref_visit_${ref || 'anon'}`,[ref])

  useEffect(() => {
    // Intento principal: ipapi.co; fallback: ipify + ipapi por IP
    (async () => {
      try {
        const d = await fetch('https://ipapi.co/json/').then(r => r.json())
        setGeo({ city: d.city || 'tu ciudad', country: d.country_name || '', ip: d.ip || '' })
      } catch {
        try {
          const ipObj = await fetch('https://api.ipify.org?format=json').then(r => r.json())
          const ip = ipObj?.ip || ''
          if (ip) {
            const d2 = await fetch(`https://ipapi.co/${ip}/json/`).then(r => r.json())
            setGeo({ city: d2.city || 'tu ciudad', country: d2.country_name || '', ip })
          }
        } catch {}
      }
    })()
  }, [])

  // Simular un feed de chat con mensajes reales (cada uno con país distinto)
  useEffect(() => {
    const locOf = (i) => LOCATIONS_CHAT[i % LOCATIONS_CHAT.length]
    const base = [
      {
        name: 'Carlos Pérez',
        img: 'https://randomuser.me/api/portraits/men/32.jpg',
        city: locOf(0).city, country: locOf(0).country,
        text: `Soy de ${locOf(0).city}. Me uní al plan de ${PLANS[2].amount} y recuperé todo en 3 días.`,
      },
      {
        name: 'Paola Ríos',
        img: 'https://randomuser.me/api/portraits/women/68.jpg',
        city: locOf(1).city, country: locOf(1).country,
        text: `Activé a 2 personas hoy; recibí $${PLANS[1].amount * 2}.`,
      },
      {
        name: 'Andrea (mamá)',
        img: 'https://randomuser.me/api/portraits/women/12.jpg',
        city: locOf(2).city, country: locOf(2).country,
        text: `En ${locOf(2).city} hice mi primer retiro por $${PLANS[0].amount}.`,
      },
      {
        name: 'Luis Romero',
        img: 'https://randomuser.me/api/portraits/men/83.jpg',
        city: locOf(3).city, country: locOf(3).country,
        text: `En ${locOf(3).city} cerré 3 activaciones esta semana.`,
      },
      {
        name: 'Ana García',
        img: 'https://randomuser.me/api/portraits/women/45.jpg',
        city: locOf(4).city, country: locOf(4).country,
        text: `Me llegó $${PLANS[2].amount} por la última activación; todo al día.`,
      },
      {
        name: 'Javier Torres',
        img: 'https://randomuser.me/api/portraits/men/15.jpg',
        city: locOf(5).city, country: locOf(5).country,
        text: 'Compré un teléfono nuevo con lo que recibí este mes.',
      },
      {
        name: 'Marta Díaz',
        img: 'https://randomuser.me/api/portraits/women/41.jpg',
        city: locOf(6).city, country: locOf(6).country,
        text: `Empecé con ${PLANS[0].amount} y ya estoy en ${PLANS[2].amount}.`,
      },
      {
        name: 'Pedro Núñez',
        img: 'https://randomuser.me/api/portraits/men/54.jpg',
        city: locOf(7).city, country: locOf(7).country,
        text: `Sumé $${PLANS[4].amount} esta semana con mis activaciones.`,
      },
      {
        name: 'Camila Reyes',
        img: 'https://randomuser.me/api/portraits/women/57.jpg',
        city: locOf(8).city, country: locOf(8).country,
        text: `Mi patrocinador me ayudó y recibí $${PLANS[3].amount} al instante.`,
      },
      {
        name: 'Sergio León',
        img: 'https://randomuser.me/api/portraits/men/72.jpg',
        city: locOf(9).city, country: locOf(9).country,
        text: `Desde ${locOf(9).city} hoy retiré $${PLANS[1].amount}.`,
      },
      {
        name: 'Lucía Prieto',
        img: 'https://randomuser.me/api/portraits/women/77.jpg',
        city: locOf(10).city, country: locOf(10).country,
        text: 'Ayudé a mi amiga a registrarse; ya obtuvo su primer pago.',
      },
      {
        name: 'Hernán Vidal',
        img: 'https://randomuser.me/api/portraits/men/27.jpg',
        city: locOf(11).city, country: locOf(11).country,
        text: `Voy por mi tercera activación en ${locOf(11).city}.`,
      },
    ]

    const start = Date.now()
    const seeded = base.map((m, i) => ({ ...m, id: i, ts: start - (base.length - i) * 60_000 }))
    setChatFeed(seeded)
  }, [geo.city])

  // Generar mensajes nuevos automáticamente
  const generateMessage = () => {
    const profiles = [
      { name: 'Sofía Méndez', img: 'https://randomuser.me/api/portraits/women/65.jpg' },
      { name: 'Diego Castro', img: 'https://randomuser.me/api/portraits/men/21.jpg' },
      { name: 'Valentina Ruiz', img: 'https://randomuser.me/api/portraits/women/71.jpg' },
      { name: 'Jorge Herrera', img: 'https://randomuser.me/api/portraits/men/46.jpg' },
      { name: 'Mariana Díaz', img: 'https://randomuser.me/api/portraits/women/22.jpg' },
      { name: 'Ricardo Salas', img: 'https://randomuser.me/api/portraits/men/52.jpg' },
      { name: 'Natalia Gómez', img: 'https://randomuser.me/api/portraits/women/38.jpg' },
      { name: 'Esteban Lara', img: 'https://randomuser.me/api/portraits/men/34.jpg' },
      { name: 'Carolina Pardo', img: 'https://randomuser.me/api/portraits/women/29.jpg' },
      { name: 'Tomás Fuentes', img: 'https://randomuser.me/api/portraits/men/66.jpg' },
    ]
    const loc = LOCATIONS_CHAT[Math.floor(Math.random()*LOCATIONS_CHAT.length)]
    const plan = PLANS[Math.floor(Math.random()*PLANS.length)].amount
    const count = 1 + Math.floor(Math.random()*3)
    const days = 1 + Math.floor(Math.random()*5)
    const amount = plan * count
    const variants = [
      `Soy de ${loc.city}. Me uní al plan de ${plan} y recuperé todo en ${days} día${days>1?'s':''}.`,
      `Activé a ${count} persona${count>1?'s':''} hoy; recibí $${amount}.`,
      `Mi patrocinador me ayudó; cerré una activación y recibí $${plan}.`,
      `Retiré $${plan} sin problemas a mi cuenta.`,
      `Ayudé a un amigo a registrarse; ya tiene su primer pago.`,
      `Desde ${loc.city}, voy por ${count} activacione${count>1?'s':''} esta semana.`,
      `Con el plan de ${plan}, estoy sumando ingresos en ${loc.city}.`,
      `Compré un teléfono nuevo con mis activaciones en ${loc.city}.`,
    ]
    const p = profiles[Math.floor(Math.random()*profiles.length)]
    const text = variants[Math.floor(Math.random()*variants.length)]
    return { name: p.name, img: p.img, text, city: loc.city, country: loc.country }
  }

  useEffect(() => {
    const intervalMs = 10000
    const id = setInterval(() => {
      setChatFeed(prev => {
        const nextId = prev.length ? prev[prev.length - 1].id + 1 : 1
        const msg = { ...generateMessage(), id: nextId, ts: Date.now() }
        const next = [...prev, msg]
        return next.slice(-100)
      })
      requestAnimationFrame(() => {
        const el = chatListRef.current
        if (el) el.scrollTop = el.scrollHeight
      })
    }, intervalMs)
    return () => clearInterval(id)
  }, [geo.city])

  // Ciclar notificación con ejemplos realistas y país coherente por nombre
  useEffect(() => {
    let idx = 0
    const show = () => {
      const n = PURCHASE_NOTICES[idx % PURCHASE_NOTICES.length]
      const text = `${n.name} de ${n.city}, ${n.country} compró el plan de ${n.plan}`
      setToast({ text, key: Date.now() })
      setToastVisible(true)
      setTimeout(() => setToastVisible(false), 4200)
      idx++
    }
    show()
    const id = setInterval(show, 7200)
    return () => clearInterval(id)
  }, [])

  const formatAgo = (ts) => {
    const diff = Math.floor((Date.now() - ts) / 1000)
    if (diff < 60) return 'hace segundos'
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`
    return `hace ${Math.floor(diff/3600)} h`
  }

  const onChatAttempt = () => {
    setShowChatGate(true)
  }

  useEffect(() => {
    if (ref) {
      // Persist sponsorId locally to survive navigation flows where the ref param is lost
      try { localStorage.setItem('ref_sponsor', ref) } catch {}
      api(`/user/${ref}/public`).then(d => {
        setSponsor({ name: d.name || 'Patrocinador', whatsappNumber: d.whatsappNumber || whatsappParam || '' })
        if (d.landingVideoUrl) setVideoUrl(d.landingVideoUrl)
        if (d.landingHeadline) setHeadline(d.landingHeadline)
      }).catch(() => {})
      // Cargar métodos de pago públicos del patrocinador
      api(`/user/${ref}/payment/public`).then(p => setPayment(p)).catch(()=>{})
      // Registrar visita única por navegador
      const already = localStorage.getItem(visitKey) === '1'
      if (!already) {
        api('/referral/visit', { method: 'POST', body: { sponsorId: ref } }).catch(()=>{})
        localStorage.setItem(visitKey, '1')
      }
    }
  }, [ref, whatsappParam])

  // Cargar configuración global del admin cuando no hay ref en la URL
  useEffect(() => {
    if (!ref) {
      api('/public/admin').then(d => {
        setSponsor({ name: d.name || 'Patrocinador', whatsappNumber: d.whatsappNumber || whatsappParam || '' })
        if (d.landingVideoUrl) setVideoUrl(d.landingVideoUrl)
        if (d.landingHeadline) setHeadline(d.landingHeadline)
      }).catch(() => {
        // Si no hay backend accesible en producción, usar el video de entorno si existe
        if (fallbackEnvVideo) setVideoUrl(fallbackEnvVideo)
      })
    }
  }, [ref, whatsappParam])

  const openWhatsApp = () => {
    const number = sponsor.whatsappNumber?.replace(/[^\d+]/g, '')
    if (!number) return alert('Este patrocinador aún no configuró su WhatsApp')
    const text = encodeURIComponent('Hola, quiero activar mi cuenta en Pliqo')
    window.open(`https://wa.me/${number}?text=${text}`, '_blank')
  }

  // Aviso postpago para subir comprobante y avisar por WhatsApp
  const [paymentConfirmVisible, setPaymentConfirmVisible] = useState(false)

  const openPayPalForPlan = (amount) => {
    if (!payment?.paypalEmail) return alert('Este patrocinador no configuró PayPal')
    const currency = (payment?.currencyCode || 'USD').toUpperCase()
    const business = encodeURIComponent(String(payment.paypalEmail).trim())
    const itemName = encodeURIComponent(`Activación Pliqo — Plan ${amount} ${currency}`)
    const url = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${business}&item_name=${itemName}&amount=${amount}&currency_code=${currency}`
    window.open(url, '_blank')
    setPaymentConfirmVisible(true)
  }

  const openBinancePayDirect = () => {
    const link = payment?.binancePayLink
    if (link) {
      window.open(link, '_blank')
    } else {
      window.open('https://pay.binance.com/en', '_blank')
      const id = payment?.binanceId
      if (id) {
        try { navigator.clipboard.writeText(String(id)) } catch {}
      }
    }
    setPaymentConfirmVisible(true)
  }

  return (
    <div className="space-y-8 text-white">
      <section className="grid lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold">
            {headline || 'Recibe 100% por activación confirmada según tu plan'}
          </h1>
          
          <div className="flex gap-3">
            <button className="btn btn-primary" onClick={() => navigate(`/register${ref ? `?ref=${ref}`: ''}`)}>
              Registrarme ahora
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/login')}>Ya tengo cuenta</button>
            <button className="btn btn-outline" onClick={openWhatsApp}>Contactar por WhatsApp</button>
          </div>
          <div className="mt-4 text-sm text-gray-300">
            Patrocinador: <span className="font-medium text-white">{sponsor.name}</span>{' '}
            {sponsor.whatsappNumber && <span>· WhatsApp: {sponsor.whatsappNumber}</span>}
          </div>
        </div>
        <div className="relative rounded-2xl border border-white/20 bg-black/60 backdrop-blur-md shadow-xl overflow-hidden">
          <VideoOnce
            src={videoUrl}
            storageKey={storageKey}
            coverText={headline || 'Dale click al video — esta oportunidad en unas horas desaparecerá'}
            onEnded={() => { if (ref) api('/referral/video', { method: 'POST', body: { sponsorId: ref } }).catch(()=>{}) }}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Planes disponibles</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {PLANS.map(p => (
            <div key={p.id} className="rounded-xl border border-white/20 bg-black/50 p-4 shadow-sm">
              <div className="text-lg font-bold text-white">${p.amount} <span className="text-xs text-gray-300">{payment?.currencyCode || 'USD'}</span></div>
              <p className="text-sm text-gray-300">Recibes ${p.amount} por activación confirmada.</p>
              <button
                className="btn btn-primary w-full mt-3"
                onClick={() => navigate(`/register${ref ? `?ref=${ref}&plan=${p.amount}` : `?plan=${p.amount}`}`)}
              >
                Elegir plan
              </button>
              {payment?.paypalEmail && (
                <button
                  className="btn btn-outline w-full mt-2"
                  onClick={() => openPayPalForPlan(p.amount)}
                >
                  Pagar con tarjeta ({payment?.currencyCode || 'USD'})
                </button>
              )}
              {(payment?.binancePayLink || payment?.binanceId) && (
                <button
                  className="btn btn-outline w-full mt-2"
                  onClick={openBinancePayDirect}
                >
                  Pagar por Binance
                </button>
              )}
            </div>
          ))}
        </div>
        {paymentConfirmVisible && (
          <div className="mt-4 rounded-xl border border-white/20 bg-black/60 p-4 shadow-sm">
            <div className="font-semibold text-white">Sube tu comprobante</div>
            <p className="text-sm text-gray-300 mt-1">Una vez realizado el pago, sube tu comprobante en tu dashboard y avisa por WhatsApp a tu patrocinador para activar tu cuenta.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={openWhatsApp}>Avisar por WhatsApp</button>
              <button className="btn btn-outline" onClick={() => navigate('/login')}>Ir al login</button>
              <button className="btn btn-outline" onClick={() => setPaymentConfirmVisible(false)}>Cerrar</button>
            </div>
          </div>
        )}
      </section>

      {/* Video se muestra arriba con portada clicable */}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Testimonios</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[{
            name: 'Rocío Salazar', role: 'Usuario',
            img: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=640&auto=format&fit=crop',
            quote: `Yo de ${geo.city}. Con Pliqo pagué mi carro; es real.`
          },{
            name: 'Felipe Andrade', role: 'Usuario',
            img: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=640&auto=format&fit=crop',
            quote: `Yo de ${geo.city}. Compré mi iPhone 16 Pro Max; increíble.`
          },{
            name: 'Claudia Navas', role: 'Usuario',
            img: 'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?q=80&w=640&auto=format&fit=crop',
            quote: `Yo de ${geo.city}. Gané $700 en mi primera semana; jamás vi algo así.`
          }].map((t, i) => (
            <div key={i} className="bg-black/50 backdrop-blur rounded-xl shadow-lg border border-white/20 p-6">
              <div className="flex items-center gap-4">
                <img className="h-14 w-14 rounded-full object-cover" src={t.img} alt={t.name} />
                <div>
                  <p className="font-semibold text-white">{t.name}</p>
                </div>
              </div>
              <p className="mt-4 text-gray-200">“{t.quote}”</p>
              <p className="text-xs text-gray-400 mt-2">Visita: {geo.city}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Chat de la comunidad */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Chat de la comunidad</h2>
        <div className="rounded-2xl border border-white/20 bg-black/60 p-4 shadow-sm">
          <div ref={chatListRef} className="h-64 overflow-y-auto space-y-3 pr-2">
            {chatFeed.map(msg => (
              <div key={msg.id} className="flex items-start gap-3">
                <img src={msg.img} alt={msg.name} className="h-9 w-9 rounded-full object-cover" />
                <div className="flex-1">
                  <div className="text-xs text-gray-400">{msg.name} · {msg.city}, {msg.country} · {formatAgo(msg.ts)}</div>
                  <div className="mt-1 inline-block rounded-2xl bg-white/10 border border-white/20 px-3 py-2 text-sm text-gray-100">
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={chatInput}
              onChange={(e)=>setChatInput(e.target.value)}
              onFocus={onChatAttempt}
              onClick={onChatAttempt}
              readOnly
              placeholder="Escribe un mensaje..."
              className="flex-1 rounded-lg bg-black/40 border border-white/20 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500"
            />
            <button className="btn btn-primary" onClick={onChatAttempt}>Enviar</button>
          </div>
        </div>
      </section>

      {/* Modal de bloqueo para chatear */}
      {showChatGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowChatGate(false)}></div>
          <div className="relative w-full max-w-md rounded-2xl border border-white/20 bg-black/80 p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-white">Para chatear, regístrate y activa un plan</h3>
            <p className="mt-2 text-sm text-gray-300">El chat es solo para usuarios activos. Crea tu cuenta y elige un plan para participar.</p>
            <div className="mt-4 flex gap-2">
              <button className="btn btn-primary" onClick={() => navigate(`/register${ref ? `?ref=${ref}`: ''}`)}>Registrarme ahora</button>
              <button className="btn btn-outline" onClick={() => setShowChatGate(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación flotante de compras */}
      {toast.text && (
        <div className={`fixed bottom-6 left-6 z-50 transition-all duration-500 ${toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <div className="rounded-xl bg-white/10 backdrop-blur border border-white/20 px-3 py-2 text-sm text-white shadow-lg">
            {toast.text}
          </div>
        </div>
      )}

      <section className="rounded-xl border border-white/20 bg-black/60 p-6 shadow-sm">
        <h3 className="text-xl font-semibold mb-2 text-white">Registro rápido</h3>
        <p className="text-gray-300 mb-4">Completa tu registro. Tu patrocinador o el admin activará tu cuenta únicamente tras confirmar el pago. Pliqo no promete ni procesa ventas sin dinero recibido.</p>
        <button className="btn btn-primary" onClick={() => navigate(`/register${ref ? `?ref=${ref}`: ''}`)}>
          Ir al registro
        </button>
      </section>
    </div>
  )
}