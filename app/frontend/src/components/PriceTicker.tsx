import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface PriceTickerProps {
  region: string
  price: number
  trend: 'up' | 'down' | 'flat'
  updatedAt: string
}

function priceColorClasses(price: number): {
  card: string
  priceText: string
  badge: string
} {
  if (price > 300) {
    return {
      card: 'bg-red-50 border-red-200',
      priceText: 'text-red-700',
      badge: 'bg-red-100 text-red-600',
    }
  }
  if (price > 100) {
    return {
      card: 'bg-amber-50 border-amber-200',
      priceText: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-600',
    }
  }
  return {
    card: 'bg-green-50 border-green-200',
    priceText: 'text-green-700',
    badge: 'bg-green-100 text-green-600',
  }
}

function TrendIcon({ trend }: { trend: PriceTickerProps['trend'] }) {
  if (trend === 'up')   return <TrendingUp  size={14} className="text-red-500"  />
  if (trend === 'down') return <TrendingDown size={14} className="text-green-500" />
  return <Minus size={14} className="text-gray-400" />
}

export default function PriceTicker({ region, price, trend, updatedAt }: PriceTickerProps) {
  const { card, priceText, badge } = priceColorClasses(price)

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
      })
    : '—'

  return (
    <div className={`rounded-lg border p-4 flex flex-col gap-2 ${card}`}>
      {/* Region label */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${badge}`}>
          {region}
        </span>
        <TrendIcon trend={trend} />
      </div>

      {/* Price */}
      <div>
        <span className={`text-2xl font-bold tabular-nums ${priceText}`}>
          ${price > 0 ? price.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </span>
        <span className="text-xs text-gray-400 ml-1">/MWh</span>
      </div>

      {/* Updated at */}
      <div className="text-xs text-gray-400">
        {formattedTime ? `Updated ${formattedTime} AEST` : 'Awaiting data…'}
      </div>
    </div>
  )
}
