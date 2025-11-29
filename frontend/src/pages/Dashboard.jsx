import { useEffect, useState, useRef } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { api, API_URL } from '../api.js'

function useAuth() {
  const [token] = useState(() => localStorage.getItem('token') || '')
  return token
}

function Summary({ user }) {
  const [sales, setSales] = useState([])
  const [buyers, setBuyers] = useState({})
  useEffect(() => {
    api('/sales', { token: localStorage.getItem('token') }).then(setSales).catch(()=>{})
  }, [])
  useEffect(() => {
    const loadBuyers = async () => {
      const ids = Array.from(new Set(sales.map(s => s.buyerId))).filter(Boolean)
      const entries = await Promise.all(ids.map(async (id) => {
        const info = await api(`/user/${id}/public`).catch(()=>({ name: 'Socio' }))
        return [id, info.name || 'Socio']
      }))
      setBuyers(Object.fromEntries(entries))
    }
    if (sales.length) loadBuyers()
  }, [sales])
  const total = sales.reduce((a, s) => a + s.amount, 0)
  const perMember = Object.values(sales.reduce((acc, s) => {
    const key = s.buyerId || 'desconocido'
    acc[key] ||= { buyerId: key, name: buyers[key] || 'Socio', total: 0 }
    acc[key].total += s.amount
    return acc
  }, {}))
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold">Plan actual: ${user.plan}</div>
        <p className="text-sm text-gray-600">Tu plan define el monto que puedes vender o recibir.</p>
      </div>
      <div className="rounded-xl border bg-white p-4">
        <div className="text-lg font-semibold">Ganancias</div>
        <p className="text-2xl font-bold">${total}</p>
      </div>
      {perMember.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <div className="text-lg font-semibold mb-2">Ganancias por socio</div>
          <div className="space-y-2">
            {perMember.map(m => (
              <div key={m.buyerId} className="flex justify-between text-sm">
                <span className="text-gray-700">{m.name}</span>
                <span className="font-medium">${m.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Settings({ user, onUserChange }) {
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || '')
  const [paypalEmail, setPaypalEmail] = useState(user?.payment?.paypalEmail || '')
  const [binanceId, setBinanceId] = useState(user?.payment?.binanceId || '')
  const [currencyCode, setCurrencyCode] = useState(user?.payment?.currencyCode || 'USD')
  const [binancePayLink, setBinancePayLink] = useState(user?.payment?.binancePayLink || '')
  const [westernUnionName, setWesternUnionName] = useState(user?.payment?.westernUnionName || '')
  const [bankTransferDetails, setBankTransferDetails] = useState(user?.payment?.bankTransferDetails || '')
  const [whatsappNumber, setWhatsappNumber] = useState(user?.whatsappNumber || '')
  const [landingVideoUrl, setLandingVideoUrl] = useState(user?.landingVideoUrl || '')
  const [landingHeadline, setLandingHeadline] = useState(user?.landingHeadline || '')
  const [msg, setMsg] = useState('')
  // Trading keys (Binance)
  const [hasTradingKeys, setHasTradingKeys] = useState(false)
  const [binanceApiKey, setBinanceApiKey] = useState('')
  const [binanceApiSecret, setBinanceApiSecret] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    api('/settings/trading-keys', { token }).then(r => setHasTradingKeys(!!r.hasKeys)).catch(()=>{})
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setMsg('')
    const token = localStorage.getItem('token')
    const data = await api('/settings', {
      method: 'POST', token,
      body: {
        payment: { paypalEmail, binanceId, currencyCode, binancePayLink, westernUnionName, bankTransferDetails },
        whatsappNumber, landingVideoUrl, landingHeadline,
      }
    })
    onUserChange(data.user)
    setMsg('Configuración guardada')
  }

  const saveTradingKeys = async (e) => {
    e?.preventDefault?.()
    setMsg('')
    const token = localStorage.getItem('token')
    try {
      await api('/settings/trading-keys', { method: 'POST', token, body: { apiKey: binanceApiKey, apiSecret: binanceApiSecret } })
      setHasTradingKeys(true)
      setBinanceApiKey('')
      setBinanceApiSecret('')
      setMsg('Claves de Binance guardadas')
    } catch (err) {
      setMsg('No se pudieron guardar las claves: ' + (err.message || 'Error'))
    }
  }

  const deleteTradingKeys = async () => {
    const token = localStorage.getItem('token')
    try {
      await api('/settings/trading-keys', { method: 'DELETE', token })
      setHasTradingKeys(false)
      setMsg('Claves de Binance eliminadas')
    } catch (err) {
      setMsg('No se pudieron eliminar: ' + (err.message || 'Error'))
    }
  }

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const onAvatarSelected = async (file) => {
    if (!file) return
    try {
      const dataUrl = await toBase64(file)
      setAvatarPreview(dataUrl)
      const token = localStorage.getItem('token')
      const r = await api('/settings', { method: 'POST', token, body: { avatarUrl: dataUrl } })
      onUserChange(r.user)
      setMsg('Foto de perfil actualizada')
    } catch (e) {
      setMsg('No se pudo actualizar la foto: ' + (e.message || 'Error'))
    }
  }

  const saveProfile = async () => {
    const token = localStorage.getItem('token')
    try {
      const r = await api('/users/me/update', { method: 'POST', token, body: { name, email } })
      onUserChange(r.user)
      setMsg('Perfil actualizado')
    } catch (e) {
      setMsg('No se pudo actualizar el perfil: ' + (e.message || 'Error'))
    }
  }

  const deleteAccount = async () => {
    const ok = confirm('¿Seguro que deseas borrar tu cuenta? Esta acción es irreversible.')
    if (!ok) return
    const token = localStorage.getItem('token')
    try {
      const r = await api('/users/me', { method: 'DELETE', token })
      if (r?.ok) {
        localStorage.removeItem('token')
        alert('Cuenta eliminada')
        navigate('/register')
      }
    } catch (e) {
      alert('No se pudo borrar la cuenta: ' + (e.message || 'Error'))
    }
  }

  const isAdmin = (user?.role || 'user') === 'admin'
  return (
    <form className="space-y-6" onSubmit={save}>
      <div className="card-dark space-y-4">
        <h3 className="text-xl font-semibold">Perfil</h3>
        <div className="grid sm:grid-cols-3 gap-4 items-start">
          <div className="sm:col-span-2 grid gap-3">
            <div>
              <label className="block text-sm font-medium text-white">Nombre</label>
              <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">Correo</label>
              <input className="input" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary" onClick={saveProfile}>Guardar perfil</button>
              <button type="button" className="btn btn-secondary" onClick={deleteAccount}>Borrar cuenta</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Foto de perfil</label>
            <div className="flex items-center gap-3">
              <img src={avatarPreview || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name || 'U')}`} alt="avatar" className="h-16 w-16 rounded-full border bg-white" />
              <label className="btn btn-outline">
                Subir foto
                <input type="file" accept="image/*" className="hidden" onChange={e=> onAvatarSelected(e.target.files?.[0])} />
              </label>
            </div>
            <p className="text-xs text-gray-300 mt-1">Se muestra en el chat IA y en tu perfil.</p>
          </div>
        </div>
      </div>
      <div className="card-dark space-y-4">
        <h3 className="text-xl font-semibold">Métodos de pago</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white">PayPal (correo)</label>
            <p className="text-xs text-gray-300 mb-1">Se mostrará a tus referidos para activar su plan.</p>
            <input className="input" placeholder="ej. tu-correo@paypal.com" value={paypalEmail} onChange={e=>setPaypalEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Binance ID</label>
            <p className="text-xs text-gray-300 mb-1">Tu identificador de Binance Pay o usuario.</p>
            <input className="input" placeholder="ej. 123456789" value={binanceId} onChange={e=>setBinanceId(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Moneda preferida</label>
            <p className="text-xs text-gray-300 mb-1">Se usará para los pagos con tarjeta (PayPal).</p>
            <select className="input" value={currencyCode} onChange={e=>setCurrencyCode(e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="MXN">MXN</option>
              <option value="BRL">BRL</option>
              <option value="COP">COP</option>
              <option value="PEN">PEN</option>
              <option value="CLP">CLP</option>
              <option value="ARS">ARS</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Enlace/QR de Binance Pay</label>
            <p className="text-xs text-gray-300 mb-1">Pega el enlace del cobro/QR para abrir pago directo.</p>
            <input className="input" placeholder="https://pay.binance.com/checkout/..." value={binancePayLink} onChange={e=>setBinancePayLink(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-white">Western Union (nombre)</label>
            <p className="text-xs text-gray-300 mb-1">Nombre completo del receptor para WU.</p>
            <input className="input" placeholder="ej. Juan Pérez" value={westernUnionName} onChange={e=>setWesternUnionName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-white">Transferencia bancaria (detalles)</label>
            <p className="text-xs text-gray-300 mb-1">Banco, cuenta/CLABE/CBU/alias y cualquier instrucción.</p>
            <textarea className="input" placeholder="ej. Banco XYZ, Cta 000-123, Alias PLIQO.PAGOS" value={bankTransferDetails} onChange={e=>setBankTransferDetails(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card-dark space-y-4">
        <h3 className="text-xl font-semibold">Landing page</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white">Número de WhatsApp</label>
            <p className="text-xs text-gray-300 mb-1">Formato internacional, se muestra a tus referidos.</p>
            <input className="input" placeholder="ej. +593987654321" value={whatsappNumber} onChange={e=>setWhatsappNumber(e.target.value)} />
          </div>
          {isAdmin && (
            <>
              <div>
                <label className="block text-sm font-medium text-white">URL del video (solo admin)</label>
                <p className="text-xs text-gray-300 mb-1">Video que aparece en la landing de todos.</p>
                <input className="input" placeholder="ej. https://www.youtube.com/watch?v=..." value={landingVideoUrl} onChange={e=>setLandingVideoUrl(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-white">Titular/Texto principal (solo admin)</label>
                <p className="text-xs text-gray-300 mb-1">Mensaje destacado para la landing.</p>
                <input className="input" placeholder="ej. Empieza a ganar hoy con Pliqo" value={landingHeadline} onChange={e=>setLandingHeadline(e.target.value)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card-dark space-y-4">
        <h3 className="text-xl font-semibold">Trading (Binance)</h3>
        {!hasTradingKeys && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white">API Key</label>
              <input className="input" value={binanceApiKey} onChange={e=>setBinanceApiKey(e.target.value)} placeholder="coloca tu API Key" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white">API Secret</label>
              <input className="input" value={binanceApiSecret} onChange={e=>setBinanceApiSecret(e.target.value)} placeholder="coloca tu API Secret" />
            </div>
            <div className="sm:col-span-2">
              <button className="btn btn-primary" onClick={saveTradingKeys} disabled={!binanceApiKey || !binanceApiSecret}>Guardar claves</button>
              <p className="text-xs text-gray-300 mt-2">Tus claves se guardan cifradas y permiten operar en vivo desde el bot.</p>
            </div>
          </div>
        )}
        {hasTradingKeys && (
          <div className="space-y-2">
            <p className="text-sm text-green-400">Claves configuradas. Ya puedes operar en vivo desde Trading.</p>
            <button className="btn btn-secondary" type="button" onClick={deleteTradingKeys}>Eliminar claves</button>
          </div>
        )}
      </div>

      {msg && <p className="text-green-400 text-sm">{msg}</p>}
      <button className="btn btn-primary" type="submit">Guardar</button>
    </form>
  )
}

function Referral({ user }) {
  const url = `${window.location.origin}/?ref=${user.id}`
  const token = localStorage.getItem('token')
  const [stats, setStats] = useState({ visits: 0, registrations: 0, videoViews: 0 })
  const [referrals, setReferrals] = useState([])
  const [requests, setRequests] = useState([])
  const [proofInputs, setProofInputs] = useState({}) // { userId: string }
  const [salesTotal, setSalesTotal] = useState(0)
  useEffect(() => { api('/users/me/referral/stats', { token }).then(setStats).catch(()=>{}) }, [])
  useEffect(() => {
    api('/users/referrals', { token }).then(setReferrals).catch(()=>{})
    api('/users/referrals/requests', { token }).then(setRequests).catch(()=>{})
    api('/sales', { token }).then(list => setSalesTotal((list || []).reduce((a,s)=>a+s.amount,0))).catch(()=>{})
  }, [])
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    alert('Enlace copiado')
  }
  const downloadPdf = async () => {
    try {
      const res = await fetch(`${API_URL}/pdf/business`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('No se pudo generar el PDF')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'modelo-negocio.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      alert('Error: ' + e.message)
    }
  }
  const approve = async (id) => {
    try {
      const proof = proofInputs[id]?.trim() || ''
      const body = {}
      if (/^https?:\/\//i.test(proof)) body.proofUrl = proof
      else if (proof) body.proofNote = proof
      await api(`/users/${id}/activate`, { token, method: 'POST', body })
      setReferrals(list => list.filter(r => r.id !== id))
      setRequests(list => list.filter(r => r.id !== id && r.userId !== id))
      alert('Usuario activado correctamente')
    } catch (e) {
      alert('No se pudo activar: ' + (e.message || 'Error'))
    }
  }
  return (
    <div className="rounded-xl border bg-white p-4 space-y-2">
      <div className="font-semibold">Tu enlace de referidos</div>
      <div className="text-sm text-gray-600 break-all">{url}</div>
      <div className="flex gap-2">
        <button className="btn btn-outline" onClick={copy}>Copiar enlace</button>
        <button className="btn" onClick={downloadPdf}>Descargar PDF del negocio</button>
      </div>
      <div className="rounded-lg border bg-gray-50 p-3 mt-3">
        <div className="font-medium mb-1">Tus datos de pago para compartir</div>
        {user?.payment ? (
          <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-700">
            {user.payment.paypalEmail && <div><div className="font-medium">PayPal</div><div>{user.payment.paypalEmail}</div></div>}
            {user.payment.binanceId && <div><div className="font-medium">Binance ID</div><div>{user.payment.binanceId}</div></div>}
            {user.payment.westernUnionName && <div><div className="font-medium">Western Union</div><div>{user.payment.westernUnionName}</div></div>}
            {user.payment.bankTransferDetails && <div className="sm:col-span-2"><div className="font-medium">Transferencia bancaria</div><div className="whitespace-pre-wrap">{user.payment.bankTransferDetails}</div></div>}
            {user.whatsappNumber && <div className="sm:col-span-2"><div className="font-medium">Tu WhatsApp</div><div>{user.whatsappNumber}</div></div>}
            {!user.payment.paypalEmail && !user.payment.binanceId && !user.payment.westernUnionName && !user.payment.bankTransferDetails && (
              <div className="sm:col-span-2 text-gray-600">Configura métodos de pago en <Link to="/dashboard/settings" className="text-brand-600 underline">Configuración</Link>.</div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">Configura tus métodos de pago en <Link to="/dashboard/settings" className="text-brand-600 underline">Configuración</Link>.</p>
        )}
        <p className="text-xs text-gray-500 mt-2">Compártelo con tu referido: él te paga a ti el 100% y tú apruebas su activación.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-sm text-gray-600">Comisiones recibidas</div>
          <div className="text-xl font-semibold">${salesTotal}</div>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-3">
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-sm text-gray-600">Entradas</div>
          <div className="text-xl font-semibold">{stats.visits}</div>
        </div>
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-sm text-gray-600">Registros</div>
          <div className="text-xl font-semibold">{stats.registrations}</div>
        </div>
        <div className="rounded-lg border bg-gray-50 p-3">
          <div className="text-sm text-gray-600">Vistas de video</div>
          <div className="text-xl font-semibold">{stats.videoViews}</div>
        </div>
      </div>
      {(requests?.length || referrals?.length) ? (
        <div className="mt-4 space-y-3">
          {requests?.length > 0 && (
              <div className="rounded-lg border bg-gray-50 p-3">
                <div className="font-medium mb-2">Solicitudes de activación</div>
                <div className="space-y-2">
                  {requests.map(r => (
                  <div key={r.requestId} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="text-sm text-gray-700">
                      {r.name} · {r.email} · Plan ${r.plan}
                      {r.lastProof ? (
                        <div className="text-xs text-gray-600 mt-1">
                          Comprobante recibido: {r.lastProof.proofUrl ? (
                            <a className="text-brand-600 underline" href={r.lastProof.proofUrl} target="_blank" rel="noopener noreferrer">Ver enlace</a>
                          ) : (
                            <span>{r.lastProof.proofNote}</span>
                          )}
                          {r.lastProof.createdAt && <span> · {new Date(r.lastProof.createdAt).toLocaleString()}</span>}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 mt-1">Aún sin comprobante recibido</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input className="input input-sm max-w-[240px]" placeholder="Añadir nota o URL (opcional)" value={proofInputs[r.id || r.userId] || ''} onChange={e=>setProofInputs(p=>({ ...p, [r.id || r.userId]: e.target.value }))} />
                      <button className="btn btn-primary" onClick={() => approve(r.id || r.userId)}>Aprobar activación</button>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
          )}
          {referrals?.length > 0 && (
            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="font-medium mb-2">Tus referidos pendientes</div>
              <div className="space-y-2">
                {referrals.map(u => (
                  <div key={u.id} className="flex items-center justify-between gap-2">
                    <div className="text-sm text-gray-700">{u.name} · {u.email} · Plan ${u.plan}</div>
                    <input className="input input-sm max-w-[240px]" placeholder="Comprobante (URL o nota)" value={proofInputs[u.id] || ''} onChange={e=>setProofInputs(p=>({ ...p, [u.id]: e.target.value }))} />
                    <button className="btn btn-primary" onClick={() => approve(u.id)}>Aprobar activación</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500 mt-2">No hay solicitudes ni referidos pendientes ahora.</p>
      )}
    </div>
  )
}

function Bets({ user }) {
  const [bets, setBets] = useState([])
  const [amount, setAmount] = useState(10)
  const [adminPayment, setAdminPayment] = useState(null)
  const token = localStorage.getItem('token')
  const load = async () => {
    const data = await api('/bets', { token }).catch(()=>[])
    setBets(data)
  }
  useEffect(() => { load(); api('/admin/payment', { token }).then(setAdminPayment).catch(()=>{}) }, [])

  const createBet = async (e) => {
    e.preventDefault()
    if (amount < 1 || amount > 100) return alert('Monto entre 1 y 100')
    const bet = await api('/bets/random', { method: 'POST', token, body: { amount } }).catch(err => { alert('Error: ' + err.message); return null })
    if (bet) { setAmount(10); load() }
  }
  const markDeposit = async (id) => { await api(`/bets/${id}/deposit`, { method: 'POST', token }).catch(()=>{}); load() }
  const startBet = async (id) => { const r = await api(`/bets/${id}/start`, { method: 'POST', token }).catch(err => { alert('Error: ' + err.message); return null }); if (r) load() }

  return (
    <div className="space-y-6">
      <div className="card-dark">
        <h3 className="text-xl font-semibold">Crear apuesta</h3>
        <form className="grid sm:grid-cols-3 gap-3 mt-2" onSubmit={createBet}>
          <div>
            <label className="block text-sm font-medium text-white">Monto (USD)</label>
            <input type="number" min="1" max="100" className="input" value={amount} onChange={e=>setAmount(Number(e.target.value))} />
          </div>
          <div className="sm:col-span-2 flex items-end">
            <button className="btn btn-primary w-full">Crear apuesta aleatoria</button>
          </div>
        </form>
        <p className="text-xs text-gray-300 mt-2">El sistema elegirá aleatoriamente un oponente entre los usuarios registrados.</p>
      </div>

      <div className="card-dark space-y-3">
        <h3 className="text-xl font-semibold">Depósito al admin</h3>
        {adminPayment ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {adminPayment?.payment?.paypalEmail && <div><div className="font-medium">PayPal</div><div className="text-sm">{adminPayment.payment.paypalEmail}</div></div>}
            {adminPayment?.payment?.binanceId && <div><div className="font-medium">Binance ID</div><div className="text-sm">{adminPayment.payment.binanceId}</div></div>}
            {adminPayment?.payment?.westernUnionName && <div><div className="font-medium">Western Union</div><div className="text-sm">{adminPayment.payment.westernUnionName}</div></div>}
            {adminPayment?.payment?.bankTransferDetails && <div className="sm:col-span-2"><div className="font-medium">Transferencia bancaria</div><div className="text-sm whitespace-pre-wrap">{adminPayment.payment.bankTransferDetails}</div></div>}
            {adminPayment?.admin?.whatsappNumber && <div className="sm:col-span-2"><div className="font-medium">WhatsApp admin</div><div className="text-sm">{adminPayment.admin.whatsappNumber}</div></div>}
          </div>
        ) : <p className="text-sm">El admin aún no configuró sus métodos de pago.</p>}
        <p className="text-xs text-gray-300">Ambos participantes deben depositar el monto acordado al admin para iniciar la ruleta.</p>
      </div>

      <div className="card-dark">
        <h3 className="text-xl font-semibold mb-2">Mis apuestas</h3>
        <div className="space-y-2">
          {bets.map(b => {
            const youDeposited = b.deposits[user.id]
            const otherId = b.creatorId === user.id ? b.opponentId : b.creatorId
            const otherDeposited = b.deposits[otherId]
            const canStart = youDeposited && otherDeposited && b.status === 'pending'
            const rivalName = b.creatorId === user.id ? (b.opponentName || 'Rival') : (b.creatorName || 'Rival')
            return (
              <div key={b.id} className="border rounded-lg p-3 bg-white text-gray-800">
                <div className="flex justify-between text-sm">
                  <div>Apuesta ${b.amount} · Estado: {b.status} · Rival: {rivalName}</div>
                  <div>{youDeposited ? 'Tu depósito: ✔' : 'Tu depósito: ✖'} · {otherDeposited ? 'Depósito rival: ✔' : 'Depósito rival: ✖'}</div>
                </div>
                {b.status === 'completed' && (
                  <div className="mt-2 text-sm">Ganador: {b.winnerId === user.id ? 'Tú' : 'Rival'} · Premio: ${b.prizeAmount} {b.payoutDelivered ? '(Pagado)' : '(Pendiente de admin)'}</div>
                )}
                <div className="flex gap-2 mt-2">
                  {!youDeposited && <button className="btn btn-outline" onClick={() => markDeposit(b.id)}>Marcar depósito realizado</button>}
                  {canStart && <button className="btn btn-primary" onClick={() => startBet(b.id)}>Iniciar ruleta</button>}
                </div>
              </div>
            )
          })}
          {bets.length === 0 && <p className="text-sm">Aún no tienes apuestas.</p>}
        </div>
      </div>
    </div>
  )
}

function Chat({ user }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([]) // {name,type,data(base64)}
  const listRef = useRef(null)
  const plans = [15, 37, 99, 187, 349, 987]
  const [selectedPlan, setSelectedPlan] = useState(user?.plan || 99)
  const [aiStatus, setAiStatus] = useState('checking')
  const [replicateEnabled, setReplicateEnabled] = useState(false)
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState('')
  const isVisionModel = (name) => /vision|llava|vl/i.test(String(name || ''))
  const visionEnabledForModel = isVisionModel(selectedModel)
  const choosePlan = (p) => {
    setSelectedPlan(p)
    setInput(`Quiero vender el plan $${p}. Dame estrategias para Facebook, Instagram y TikTok (contenido, frecuencia, hashtags y CTA), guiones para DM/WhatsApp y objeciones, e indica cómo compartir mi enlace de referidos y construir marca con foto y testimonios.`)
  }
  const referralLink = `${window.location.origin}/?ref=${user.id}`
  const payment = user?.payment || {}
  const paymentLines = [
    payment.paypalEmail ? `• PayPal: ${payment.paypalEmail}` : '',
    payment.binanceId ? `• Binance ID: ${payment.binanceId}` : '',
    payment.westernUnionName ? `• Western Union: ${payment.westernUnionName}` : '',
    payment.bankTransferDetails ? `• Transferencia bancaria: ${payment.bankTransferDetails}` : ''
  ].filter(Boolean).join('\n')
  const videoLine = user?.landingVideoUrl ? `Mira este video: ${user.landingVideoUrl}\n` : ''

  const templates = [
    {
      title: 'Primer contacto',
      text: `Hola 👋\nTe cuento cómo ganar con Pliqo. Activando el plan $${selectedPlan} puedes vender y recibir ese monto por cada activación.\n${videoLine}Regístrate con mi enlace: ${referralLink}\n¿Te interesa? Te acompaño en el proceso.`
    },
    {
      title: 'Seguimiento 24h',
      text: `¿Pudiste ver la info? El plan $${selectedPlan} paga ${selectedPlan} por activación.\nRegístrate aquí: ${referralLink}\nSi te animas hoy, te ayudo a activar y empezar a atraer clientes.`
    },
    {
      title: 'Cierre y activación',
      text: `Para activar el plan $${selectedPlan}:\n${paymentLines || 'Elige un método de pago y te paso los datos.'}\nTras el pago, activo tu cuenta y te doy material para publicar hoy mismo.`
    },
    {
      title: 'Objeciones comunes',
      text: `• No tengo tiempo: puedes publicar 10–15 min al día (plantillas listas).\n• No tengo dinero: el plan $${selectedPlan} se recupera con la primera activación.\n• No sé vender: te doy guiones y ejemplos para Facebook/Instagram/TikTok.`
    },
    {
      title: 'Post-venta / testimonio',
      text: `Cuando tengas tu primer pago, sube un video corto mostrando la confirmación y comenta cómo lo lograste. Si aún no tienes uno, usa testimonios de otros usuarios con su autorización para generar confianza.`
    }
  ]

  const useTemplate = (t) => setInput(t)
  const copyTemplate = async (t) => {
    await navigator.clipboard.writeText(t)
    alert('Plantilla copiada')
  }
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = String(reader.result || '')
      const base64 = s.includes(',') ? s.split(',')[1] : s
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const onFilesSelected = async (files) => {
    const list = []
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue
      const data = await toBase64(f)
      list.push({ name: f.name, type: f.type, data })
    }
    if (list.length) setAttachments(prev => [...prev, ...list])
  }
  const send = async () => {
    if (!input.trim()) return
    const userText = input
    const imgs = attachments.map(a => `data:${a.type};base64,${a.data}`)
    setMessages(m => [...m, { role: 'user', text: userText, images: imgs }])
    setInput('')
    setAttachments([])
    try {
      const token = localStorage.getItem('token')
      const res = await api('/ai/chat', { method: 'POST', token, body: { prompt: userText, images: attachments.map(a => a.data), model: selectedModel || undefined } })
      const reply = res?.reply || 'IA no disponible'
      setMessages(m => [...m, { role: 'assistant', text: reply }])
    } catch (err) {
      const fallback = 'IA no disponible: ' + (err?.message || 'error')
      setMessages(m => [...m, { role: 'assistant', text: fallback }])
    }
  }
  const generateImage = async () => {
    const token = localStorage.getItem('token')
    try {
      const prompt = input.trim() || messages.slice().reverse().find(m => m.role === 'user')?.text || 'Genera una imagen temática para Pliqo'
      const res = await api('/ai/image/generate', { method: 'POST', token, body: { prompt } })
      const imgs = Array.isArray(res.images) ? res.images : []
      if (!imgs.length) throw new Error('Sin salida de imagen')
      setMessages(m => [...m, { role: 'assistant', text: 'Imagen generada', images: imgs }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Error generando imagen: ' + (e?.message || 'verifica token REPLICATE') }])
    }
  }
  const generateVideo = async () => {
    const token = localStorage.getItem('token')
    // Usa la última imagen disponible de mensajes
    const lastImg = [...messages].reverse().find(m => (m.images || []).length)?.images?.[0]
    if (!lastImg) {
      alert('Primero genera o adjunta una imagen')
      return
    }
    try {
      const res = await api('/ai/video/generate', { method: 'POST', token, body: { imageUrl: lastImg } })
      const vids = Array.isArray(res.videos) ? res.videos : []
      if (!vids.length) throw new Error('Sin salida de video')
      setMessages(m => [...m, { role: 'assistant', text: 'Video generado', video: vids[0] }])
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Error generando video: ' + (e?.message || 'verifica token REPLICATE') }])
    }
  }
  useEffect(() => {
    const token = localStorage.getItem('token')
    api('/ai/status', { token }).then(r => setAiStatus(r.ok ? 'online' : 'offline')).catch(() => setAiStatus('offline'))
    api('/ai/replicate/status', { token }).then(r => setReplicateEnabled(!!r.enabled)).catch(() => setReplicateEnabled(false))
    api('/ai/models', { token }).then(r => {
      const list = Array.isArray(r.models) ? r.models : []
      setModels(list)
      const saved = localStorage.getItem('chat_model') || ''
      const names = list.map(m => m.name)
      setSelectedModel(saved && names.includes(saved) ? saved : (names[0] || ''))
    }).catch(() => {
      setModels([])
    })
  }, [])
  useEffect(() => {
    if (selectedModel) localStorage.setItem('chat_model', selectedModel)
  }, [selectedModel])
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3">
        {aiStatus === 'online' && (
          <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">Ollama conectado</span>
        )}
        {aiStatus === 'offline' && (
          <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">Ollama no disponible</span>
        )}
        {aiStatus === 'checking' && (
          <span className="inline-block bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm">Comprobando estado de Ollama…</span>
        )}
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <div>
            <label className="block text-sm font-medium text-gray-700">Modelo</label>
            <select className="input" value={selectedModel} onChange={e=>setSelectedModel(e.target.value)}>
              {models.length === 0 && <option value="">Cargando…</option>}
              {models.map(m => (
                <option key={m.name} value={m.name}>{m.name} {m.parameter_size ? `(${m.parameter_size})` : ''}</option>
              ))}
            </select>
          </div>
          {!!selectedModel && (
            <span className={visionEnabledForModel ? 'inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs' : 'inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs'}>
              {visionEnabledForModel ? 'Visión habilitada' : 'Solo texto'}
            </span>
          )}
        </div>
      </div>
      <div className="rounded-lg bg-gray-50 border p-3 mb-3">
        <div className="font-medium mb-2">Planes de activación</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {plans.map((p) => (
            <div key={p} className="flex items-center justify-between text-sm bg-white border rounded-md p-2">
              <div>
                <div className="font-semibold">${p}</div>
                <div className="text-gray-600">Vende y recibe ${p} por activación.</div>
              </div>
              <button className="btn btn-outline" onClick={() => choosePlan(p)}>Elegir plan</button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 text-xs">
          <button className="btn btn-outline" onClick={() => setInput('Dame estrategias de marketing para Facebook con ejemplos de publicaciones, hashtags y CTA para Pliqo.')}>Estrategias Facebook</button>
          <button className="btn btn-outline" onClick={() => setInput('Dame estrategias de marketing para Instagram: carruseles, stories, reels, hashtags y CTA para Pliqo.')}>Estrategias Instagram</button>
          <button className="btn btn-outline" onClick={() => setInput('Dame ideas de contenido para TikTok con guiones cortos y CTA para Pliqo.')}>Estrategias TikTok</button>
          <button className="btn btn-outline" onClick={() => setInput('Escribe un guión de venta para DM/WhatsApp con manejo de objeciones y CTA.')}>Guión de venta</button>
        </div>
        <div className="mt-3">
          <div className="font-medium mb-1">Plantillas de texto para tu cliente</div>
          <div className="space-y-2">
            {templates.map((tpl, i) => (
              <div key={i} className="border rounded-md p-2 bg-white">
                <div className="text-sm font-semibold mb-1">{tpl.title}</div>
                <pre className="text-xs whitespace-pre-wrap text-gray-700">{tpl.text}</pre>
                <div className="flex gap-2 mt-2">
                  <button className="btn btn-outline" onClick={() => useTemplate(tpl.text)}>Usar en chat</button>
                  <button className="btn btn-outline" onClick={() => copyTemplate(tpl.text)}>Copiar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div ref={listRef} className="space-y-2 max-h-[50vh] overflow-y-auto">
        {messages.map((m, i) => {
          const meAvatar = user?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.name || 'U')}`
          const aiAvatar = `https://api.dicebear.com/8.x/bottts/svg?seed=PliqoAI`
          const isUser = m.role === 'user'
          return (
            <div key={i} className={`flex items-start gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && <img src={aiAvatar} alt="AI" className="h-7 w-7 rounded-full border" />}
              <div className={isUser ? 'bg-brand-600 text-white px-3 py-2 rounded-2xl max-w-[70%]' : 'bg-gray-100 px-3 py-2 rounded-2xl max-w-[70%]'}>
                {m.text && <div className="whitespace-pre-wrap text-sm">{m.text}</div>}
                {!!(m.images && m.images.length) && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {m.images.map((img, idx) => (
                      <img key={idx} src={img.startsWith('http') ? img : `${img}`} alt="imagen" className="rounded-lg border" />
                    ))}
                  </div>
                )}
                {m.video && (
                  <div className="mt-2">
                    <video src={m.video} controls className="rounded-lg border w-full" />
                  </div>
                )}
              </div>
              {isUser && <img src={meAvatar} alt="Yo" className="h-7 w-7 rounded-full border" />}
            </div>
          )
        })}
      </div>
      {/* Adjuntos y entrada */}
      {!!attachments.length && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <img key={i} src={`data:${a.type};base64,${a.data}`} alt={a.name} className="h-16 w-16 object-cover rounded border" />
          ))}
          <button className="btn btn-outline btn-sm" onClick={() => setAttachments([])}>Quitar adjuntos</button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <textarea rows={2} className="input input--light flex-1 min-w-[240px] sm:min-w-[380px] text-base py-2" value={input} onChange={e=>setInput(e.target.value)} placeholder="Escribe tu mensaje" />
        {visionEnabledForModel && (
          <label className="btn btn-outline shrink-0">
            Adjuntar imagen
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e)=> onFilesSelected(e.target.files)} />
          </label>
        )}
        <button className="btn btn-primary" onClick={send}>Enviar</button>
        {replicateEnabled && (
          <>
            <button className="btn btn-secondary" onClick={generateImage}>Generar imagen</button>
            <button className="btn btn-secondary" onClick={generateVideo}>Generar video</button>
          </>
        )}
      </div>
      {!replicateEnabled && (
        <p className="text-xs text-gray-500 mt-1">Generación de imagen/video desactivada (sin token de Replicate).</p>
      )}
      <p className="text-xs text-gray-500 mt-2">Ollama debe estar disponible en el backend. El asistente conoce tus planes y tu enlace de referidos.</p>
    </div>
  )
}

function Trading({ user }) {
  const token = localStorage.getItem('token')
  const [mode, setMode] = useState('futuros')
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [interval, setInterval] = useState('5m')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  // Bots y educación
  const [binanceState, setBinanceState] = useState({ running: false, logs: [] })
  const [binaryState, setBinaryState] = useState({ running: false, logs: [] })
  const [canLiveTrade, setCanLiveTrade] = useState(false)
  const [live, setLive] = useState(false)
  const load = async () => {
    setLoading(true)
    setResult(null)
    const path = mode === 'futuros' ? `/signals/binance/futures?symbol=${symbol}&interval=${interval}` : `/signals/binary?symbol=${symbol}&interval=${interval}`
    const r = await api(path, { token }).catch(err => ({ error: err.message }))
    setResult(r)
    setLoading(false)
  }
  const refreshBots = async () => {
    try {
      const b1 = await api('/bot/binance/status', { token })
      setBinanceState({ running: !!b1.running, logs: b1.logs || [] })
      setCanLiveTrade(!!b1.hasKeys)
      setLive(!!b1.live)
    } catch (e) {}
    try {
      const b2 = await api('/bot/binary/status', { token })
      setBinaryState({ running: !!b2.running, logs: b2.logs || [] })
    } catch (e) {}
  }
  const startBinance = async () => {
    await api('/bot/binance/start', { token, method: 'POST', body: { symbol, interval, live } }).catch(err=>alert(err.message || 'Error'))
    refreshBots()
  }
  const stopBinance = async () => {
    await api('/bot/binance/stop', { token, method: 'POST' }).catch(()=>{})
    refreshBots()
  }
  const startBinary = async () => {
    await api('/bot/binary/start', { token, method: 'POST', body: { symbol } }).catch(()=>{})
    refreshBots()
  }
  const stopBinary = async () => {
    await api('/bot/binary/stop', { token, method: 'POST' }).catch(()=>{})
    refreshBots()
  }
  useEffect(() => { load(); refreshBots() }, [])
  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700">Modo</label>
          <select className="input" value={mode} onChange={e=>setMode(e.target.value)}>
            <option value="futuros">Señales Futuros (Binance)</option>
            <option value="binarias">Señales Binarias</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Símbolo</label>
          <input className="input" value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Marco temporal</label>
          <select className="input" value={interval} onChange={e=>setInterval(e.target.value)}>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? 'Cargando…' : 'Actualizar señales'}</button>
      </div>
      {!result && <p className="text-sm">Cargando…</p>}
      {result && result.error && <p className="text-sm text-red-600">Error: {result.error}</p>}
      {result && !result.error && (
        <div className="space-y-2">
          <div className="text-lg font-semibold">{mode === 'futuros' ? `Señal ${result.signal}` : `Señal ${result.signal}`}</div>
          {mode === 'futuros' && (
            <div className="text-sm text-gray-700">
              <div>Entrada aprox: ${result.entry}</div>
              <div>Stop Loss: ${result.stopLoss}</div>
              <div>Take Profit: ${result.takeProfit}</div>
              <div>Confianza: {result.confidence}%</div>
            </div>
          )}
          <div className="text-sm text-gray-700">
            <div className="font-medium">Razones</div>
            <ul className="list-disc ml-5">
              {(result.reasons || []).map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
          <div className="text-sm text-gray-700">
            <div className="font-medium">Guía operativa</div>
            <ul className="list-disc ml-5">
              {(result.guide || []).map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
          <p className="text-xs text-gray-500">Aviso: No es consejo financiero. Opera con responsabilidad.</p>
        </div>
      )}
      {/* Educación adicional */}
      <div className="rounded-lg border bg-gray-50 p-3">
        <div className="font-semibold mb-1">Cómo operar paso a paso</div>
        <ul className="list-disc ml-5 text-sm text-gray-700">
          <li>Define riesgo por operación (1–2% de tu cuenta).</li>
          <li>Confirma dirección con EMA20 vs EMA50 y RSI.</li>
          <li>Espera retrocesos para entrar; evita alta volatilidad.</li>
          <li>Coloca stop donde invalida la idea; TP razonable.</li>
          <li>Lleva diario: entrada, salida, emoción y mejora.</li>
        </ul>
      </div>
      {/* Control de bots */}
      <div className="rounded-lg border bg-gray-50 p-3">
        <div className="font-semibold mb-2">Bots de práctica</div>
        <div className="flex items-center gap-2 mb-2">
          <label className="text-sm">Operar en vivo</label>
          <input type="checkbox" className="toggle" checked={live} onChange={e=>setLive(e.target.checked)} disabled={!canLiveTrade} />
          {!canLiveTrade && <span className="text-xs text-gray-500">Configura tus claves en Configuración.</span>}
        </div>
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <span className="text-sm">Binance (futuros) — {binanceState.running ? 'En ejecución' : 'Detenido'}</span>
          {!binanceState.running ? (
            <button className="btn btn-primary btn-sm" onClick={startBinance}>Iniciar bot</button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={stopBinance}>Detener bot</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <span className="text-sm">Binarias (simulado) — {binaryState.running ? 'En ejecución' : 'Detenido'}</span>
          {!binaryState.running ? (
            <button className="btn btn-primary btn-sm" onClick={startBinary}>Iniciar bot</button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={stopBinary}>Detener bot</button>
          )}
        </div>
        <div className="text-sm font-medium mt-2">Últimos eventos</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
          <div className="bg-white border rounded p-2">
            <div className="font-medium text-sm">Binance</div>
            <ul className="text-xs max-h-40 overflow-y-auto">
              {binanceState.logs.length === 0 && <li className="text-gray-500">Sin eventos</li>}
              {binanceState.logs.map((l,i)=> (
                <li key={i}>
                  {new Date(l.ts).toLocaleTimeString()} — {l.side || ''} {l.symbol} @ {l.price || ''} {l.reason ? `(${l.reason})` : ''}
                  {l.error && <span className="text-red-600"> — {l.error}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border rounded p-2">
            <div className="font-medium text-sm">Binarias</div>
            <ul className="text-xs max-h-40 overflow-y-auto">
              {binaryState.logs.length === 0 && <li className="text-gray-500">Sin eventos</li>}
              {binaryState.logs.map((l,i)=> (
                <li key={i}>
                  {new Date(l.ts).toLocaleTimeString()} — {l.direction} {l.symbol} {l.reason ? `(${l.reason})` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">Usa el bot para practicar. Si activas “Operar en vivo”, se usarán tus claves guardadas.</p>
      </div>
    </div>
  )
}

function ActivationCTA({ user }) {
  const [info, setInfo] = useState(null)
  const [adminPayment, setAdminPayment] = useState(null)
  const [show, setShow] = useState(true)
  const [proof, setProof] = useState('')
  useEffect(() => {
    if (!user?.active) {
      const token = localStorage.getItem('token')
      api('/users/me/sponsor', { token }).then(setInfo).catch(()=>{})
      api('/admin/payment', { token }).then(setAdminPayment).catch(()=>{})
    }
  }, [user])

  const openWhatsApp = () => {
    const number = info?.sponsor?.whatsappNumber?.replace(/[^\d+]/g, '')
    if (!number) return alert('Tu patrocinador aún no configuró su WhatsApp')
    const text = encodeURIComponent(`Hola, quiero activar mi plan de $${user.plan} en Pliqo`)
    window.open(`https://wa.me/${number}?text=${text}`, '_blank')
  }

  if (user?.active) return null

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Tu cuenta está pendiente de activación</div>
        <button className="btn btn-primary" onClick={() => setShow(s => !s)}>Activa tu plan hoy mismo</button>
      </div>
      {show && (
        <div className="mt-3 text-sm text-gray-700">
          {info?.sponsor ? (
            <div className="space-y-2">
              <div>Patrocinador: <span className="font-medium">{info.sponsor.name}</span> · Plan: ${info.sponsor.plan}</div>
              {info.sponsor.whatsappNumber && <div>WhatsApp: {info.sponsor.whatsappNumber}</div>}
              {info?.pending && (
                <div className="inline-block bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs">En confirmación por tu patrocinador</div>
              )}
              <div className="grid sm:grid-cols-2 gap-3 mt-2">
                {info?.payment?.paypalEmail && (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="font-medium">PayPal</div>
                    <div className="text-gray-600">{info.payment.paypalEmail}</div>
                  </div>
                )}
                {info?.payment?.binanceId && (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="font-medium">Binance ID</div>
                    <div className="text-gray-600">{info.payment.binanceId}</div>
                  </div>
                )}
                {info?.payment?.westernUnionName && (
                  <div className="rounded-lg border bg-gray-50 p-3">
                    <div className="font-medium">Western Union</div>
                    <div className="text-gray-600">{info.payment.westernUnionName}</div>
                  </div>
                )}
                {info?.payment?.bankTransferDetails && (
                  <div className="rounded-lg border bg-gray-50 p-3 sm:col-span-2">
                    <div className="font-medium">Transferencia bancaria</div>
                    <div className="text-gray-600 whitespace-pre-wrap">{info.payment.bankTransferDetails}</div>
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="btn btn-outline" onClick={openWhatsApp}>Pagar por WhatsApp</button>
                <input
                  className="input input-bordered flex-1 min-w-[240px]"
                  placeholder="Comprobante (URL o nota)"
                  value={proof}
                  onChange={e => setProof(e.target.value)}
                />
                <button className="btn btn-primary" disabled={!!info?.pending} onClick={async () => {
                  try {
                    const token = localStorage.getItem('token')
                    const isUrl = /^https?:\/\//i.test(proof)
                    const body = {}
                    if (proof.trim()) {
                      if (isUrl) body.proofUrl = proof.trim()
                      else body.proofNote = proof.trim()
                    }
                    await api('/users/me/notify-payment', { token, method: 'POST', body })
                    alert('Notificación enviada a tu patrocinador')
                  } catch (e) {
                    alert('No se pudo notificar: ' + (e.message || 'Error'))
                  }
                }}>{info?.pending ? 'En confirmación…' : 'Notificar pago'}</button>
              </div>
              <p className="text-xs text-gray-500">Tras tu pago directo, tu patrocinador aprobará tu cuenta.</p>

              <div className="rounded-lg border bg-gray-50 p-3 mt-3">
                <div className="font-medium mb-1">Tus datos de pago (para compartir)</div>
                {user?.payment ? (
                  <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-700">
                    {user.payment.paypalEmail && <div><div className="font-medium">PayPal</div><div>{user.payment.paypalEmail}</div></div>}
                    {user.payment.binanceId && <div><div className="font-medium">Binance ID</div><div>{user.payment.binanceId}</div></div>}
                    {user.payment.westernUnionName && <div><div className="font-medium">Western Union</div><div>{user.payment.westernUnionName}</div></div>}
                    {user.payment.bankTransferDetails && <div className="sm:col-span-2"><div className="font-medium">Transferencia bancaria</div><div className="whitespace-pre-wrap">{user.payment.bankTransferDetails}</div></div>}
                    {user.whatsappNumber && <div className="sm:col-span-2"><div className="font-medium">Tu WhatsApp</div><div>{user.whatsappNumber}</div></div>}
                    {!user.payment?.paypalEmail && !user.payment?.binanceId && !user.payment?.westernUnionName && !user.payment?.bankTransferDetails && (
                      <div className="sm:col-span-2 text-gray-600">Configura métodos de pago en <Link to="/dashboard/settings" className="text-brand-600 underline">Configuración</Link>.</div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Configura tus métodos de pago en <Link to="/dashboard/settings" className="text-brand-600 underline">Configuración</Link>.</p>
                )}
                <p className="text-xs text-gray-500 mt-2">Esquema de comisiones: 1er y 2do pago para ti; 3er pago para tu patrocinador; luego todos los pagos para ti.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p>No encontramos tu patrocinador. Asegúrate de registrarte con un enlace válido.</p>
              {adminPayment?.admin?.whatsappNumber && (
                <div className="flex gap-2">
                  <button className="btn btn-outline" onClick={() => {
                    const number = adminPayment.admin.whatsappNumber.replace(/[^\d+]/g, '')
                    const text = encodeURIComponent('Hola, necesito que me asignen un patrocinador para activar mi cuenta en Pliqo.')
                    window.open(`https://wa.me/${number}?text=${text}`, '_blank')
                  }}>Contactar admin por WhatsApp</button>
                </div>
              )}
              <div className="rounded-lg border bg-gray-50 p-3 mt-3">
                <div className="font-medium mb-1">Tus datos de pago (para compartir)</div>
                {user?.payment ? (
                  <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-700">
                    {user.payment.paypalEmail && <div><div className="font-medium">PayPal</div><div>{user.payment.paypalEmail}</div></div>}
                    {user.payment.binanceId && <div><div className="font-medium">Binance ID</div><div>{user.payment.binanceId}</div></div>}
                    {user.payment.westernUnionName && <div><div className="font-medium">Western Union</div><div>{user.payment.westernUnionName}</div></div>}
                    {user.payment.bankTransferDetails && <div className="sm:col-span-2"><div className="font-medium">Transferencia bancaria</div><div className="whitespace-pre-wrap">{user.payment.bankTransferDetails}</div></div>}
                    {user.whatsappNumber && <div className="sm:col-span-2"><div className="font-medium">Tu WhatsApp</div><div>{user.whatsappNumber}</div></div>}
                    {!user.payment?.paypalEmail && !user.payment?.binanceId && !user.payment?.westernUnionName && !user.payment?.bankTransferDetails && (
                      <div className="sm:col-span-2 text-gray-600">Configura métodos de pago en <Link to="/dashboard/settings" className="text-brand-600 underline">Configuración</Link>.</div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Configura tus métodos de pago en <Link to="/dashboard/settings" className="text-brand-600 underline">Configuración</Link>.</p>
                )}
                <p className="text-xs text-gray-500 mt-2">Esquema de comisiones: 1er y 2do pago para ti; 3er pago para tu patrocinador; luego todos los pagos para ti.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const token = useAuth()
  const [user, setUser] = useState(null)
  const [pendingActivation, setPendingActivation] = useState(false)
  useEffect(() => {
    if (!token) return navigate('/login')
    api('/users/me', { token }).then(setUser).catch(()=>navigate('/login'))
  }, [token])

  useEffect(() => {
    if (!user || user.active) return
    const token = localStorage.getItem('token')
    api('/users/me/sponsor', { token }).then(info => setPendingActivation(!!info?.pending)).catch(()=>{})
  }, [user])

  if (!user) return <p>Cargando...</p>

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      <aside className="lg:col-span-1 space-y-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center gap-3">
            <img src={user?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user?.name || 'U')}`} alt="avatar" className="h-10 w-10 rounded-full border" />
            <div>
              <div className="font-semibold">Hola, {user.name}</div>
              <div className="text-sm text-gray-600">Plan: ${user.plan} · Nivel: {user.level || '—'} · Estado: {user.active ? 'Activo' : 'Pendiente'} {(!user.active && pendingActivation) && (<span className="ml-1 inline-block bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">En confirmación</span>)}</div>
            </div>
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          <Link to="/dashboard" className="btn btn-outline">Resumen</Link>
          <Link to="/dashboard/settings" className="btn btn-outline">Configuración</Link>
          <Link to="/dashboard/referral" className="btn btn-outline">Referidos</Link>
          {user.active && <Link to="/dashboard/chat" className="btn btn-outline">Chat IA</Link>}
          {user.active && <Link to="/dashboard/trading" className="btn btn-outline">Trading</Link>}
          {user.active && <Link to="/dashboard/bets" className="btn btn-outline">Apuestas</Link>}
          <button className="btn btn-outline" onClick={() => { localStorage.removeItem('token'); navigate('/'); }}>Cerrar sesión</button>
        </nav>
      </aside>
      <section className="lg:col-span-3 space-y-6">
        <ActivationCTA user={user} />
        <Routes>
          <Route index element={<Summary user={user} />} />
          <Route path="settings" element={<Settings user={user} onUserChange={setUser} />} />
          <Route path="referral" element={<Referral user={user} />} />
          <Route path="chat" element={user.active ? <Chat user={user} /> : <ActivationCTA user={user} />} />
          <Route path="trading" element={user.active ? <Trading user={user} /> : <ActivationCTA user={user} />} />
          <Route path="bets" element={user.active ? <Bets user={user} /> : <ActivationCTA user={user} />} />
          <Route path="*" element={<Summary user={user} />} />
        </Routes>
      </section>
    </div>
  )
}