import { useMemo } from 'react'

export default function PaymentButtons({ payment, plans = [], sponsorName = 'Patrocinador' }) {
  const hasPayPal = !!(payment?.paypalEmail)
  const hasBinance = !!(payment?.binanceId || payment?.binancePayLink)

  const sanitizedEmail = useMemo(() => String(payment?.paypalEmail || '').trim(), [payment])
  const sanitizedBinance = useMemo(() => String(payment?.binanceId || '').trim(), [payment])

  const openPayPal = (amount) => {
    const business = sanitizedEmail
    if (!business) return alert('El patrocinador no configuró PayPal')
    const currency = String(payment?.currencyCode || 'USD').toUpperCase()
    const params = new URLSearchParams({
      cmd: '_xclick',
      business,
      item_name: `Activación Pliqo - ${sponsorName}`,
      amount: String(amount),
      currency_code: currency,
      no_shipping: '1',
      no_note: '1',
      lc: 'ES'
    })
    window.open(`https://www.paypal.com/cgi-bin/webscr?${params.toString()}`, '_blank')
  }

  const openBinance = () => {
    const link = String(payment?.binancePayLink || '').trim()
    if (link) {
      window.open(link, '_blank')
      return
    }
    const id = sanitizedBinance
    if (!id) return alert('El patrocinador no configuró Binance Pay')
    window.open('https://pay.binance.com/en/', '_blank')
  }

  if (!hasPayPal && !hasBinance) return null

  return (
    <div className="rounded-2xl border border-white/20 bg-black/60 p-4">
      <h3 className="text-lg font-semibold text-white">Pago inmediato</h3>
      <p className="text-sm text-gray-300 mt-1">Paga tu activación y guarda el comprobante. Tu patrocinador confirmará el pago y activará tu cuenta.</p>
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        {hasPayPal && (
          <div className="space-y-2">
            <div className="text-sm text-gray-300">PayPal: {sanitizedEmail}</div>
            <div className="flex flex-wrap gap-2">
              {plans.map(p => (
                <button key={p.id} className="btn btn-primary btn-sm" onClick={() => openPayPal(p.amount)}>
                  Pagar ${p.amount} con PayPal
                </button>
              ))}
            </div>
          </div>
        )}
        {hasBinance && (
          <div className="space-y-2">
            {payment?.binancePayLink ? (
              <>
                <div className="text-sm text-gray-300">Binance Pay (enlace/QR configurado)</div>
                <div className="flex gap-2">
                  <button className="btn btn-outline btn-sm" onClick={openBinance}>Pagar por Binance (directo)</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-300">Binance ID: {sanitizedBinance}</div>
                <div className="flex gap-2">
                  <button className="btn btn-outline btn-sm" onClick={openBinance}>Abrir Binance Pay</button>
                  <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(sanitizedBinance)}>Copiar ID</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3">Nota: el pago con tarjeta vía PayPal depende de tu región y configuración de cuenta. Si tienes dudas, coordina por WhatsApp con tu patrocinador.</p>
    </div>
  )
}