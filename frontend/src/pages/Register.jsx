import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'

const PLANS = [15,37,99,187,349,987]

export default function Register() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState(PLANS.includes(Number(params.get('plan'))) ? Number(params.get('plan')) : 15)
  const refParam = params.get('ref') || ''
  const savedRef = (() => { try { return localStorage.getItem('ref_sponsor') || '' } catch { return '' } })()
  const ref = refParam || savedRef
  const [error, setError] = useState('')

  useEffect(() => {
    if (params.get('plan')) {
      const p = Number(params.get('plan'))
      if (PLANS.includes(p)) setPlan(p)
    }
  }, [params])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = await api('/auth/register', { method: 'POST', body: { name, email, phone, password, plan, sponsorId: ref || null } })
      localStorage.setItem('token', data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Error al registrar')
    }
  }

  return (
    <div className="mx-auto max-w-md card-dark">
      <h1 className="text-2xl font-bold mb-4 text-white">Crear cuenta</h1>
      {ref && <p className="text-sm text-gray-300 mb-2">Patrocinador ID: {ref}</p>}
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label className="block text-sm font-medium text-gray-200">Nombre completo</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200">Correo</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200">Número celular</label>
          <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200">Contraseña</label>
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-200">Plan</label>
          <select className="input" value={plan} onChange={e=>setPlan(Number(e.target.value))}>
            {PLANS.map(p => <option key={p} value={p}>${p}</option>)}
          </select>
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button className="btn btn-primary w-full" type="submit">Crear cuenta</button>
      </form>
      <p className="text-sm text-gray-300 mt-3">Tu patrocinador aprobará tu cuenta tras tu pago directo.</p>
    </div>
  )
}