import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export interface PriceTickerProps {
  region: string
  price: number
  trend: 'up' | 'down' | 'flat'
  updatedAt: string
}

const REGION_FULL_NAMES: Record<string, string> = {
  NSW1: 'New South Wales',
  QLD1: 'Queensland',
  VIC1: 'Victoria',
  SA1:  'South Australia',
  TAS1: 'Tasmania',
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
  if (trend === 'up') {
    return (
      <TrendingUp
        size={16}
        className="text-red-500 transition-transform duration-300 ease-in-out animate-bounce-up"
        style={{ transition: 'transform 0.3s ease-in-out, color 0.3s ease-in-out' }}
      />
    )
  }
  if (trend === 'down') {
    return (
      <TrendingDown
        size={16}
        className="text-green-500 transition-transform duration-300 ease-in-out animate-bounce-down"
        style={{ transition: 'transform 0.3s ease-in-out, color 0.3s ease-in-out' }}
      />
    )
  }
  return (
    <Minus
      size={16}
      className="text-gray-400"
      style={{ transition: 'transform 0.3s ease-in-out, color 0.3s ease-in-out' }}
    />
  )
}

function formatPrice(price: number): string {
  // Format as $X,XXX.XX with comma thousands separator
  return price.toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function PriceTicker({ region, price, trend, updatedAt }: PriceTickerProps) {
  const { card, priceText, badge } = priceColorClasses(price)
  const fullName = REGION_FULL_NAMES[region] ?? region

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Australia/Sydney',
      })
    : '—'

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 ${card}`}
      style={{ transition: 'background-color 0.4s ease-in-out, border-color 0.4s ease-in-out' }}
    >
      {/* Region label row */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className={`text-xs font-bold px-2 py-0.5 rounded self-start ${badge}`}>
            {region}
          </span>
          <span className="text-xs text-gray-500 mt-0.5 leading-tight">{fullName}</span>
        </div>
        {/* Trend arrow with CSS transition for smooth animation */}
        <span
          style={{ transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out' }}
          aria-label={`Trend: ${trend}`}
        >
          <TrendIcon trend={trend} />
        </span>
      </div>

      {/* Price */}
      <div>
        <span
          className={`text-2xl font-bold tabular-nums ${priceText}`}
          style={{ transition: 'color 0.4s ease-in-out' }}
        >
          {price > 0 ? `$${formatPrice(price)}` : '—'}
        </span>
        <span className="text-xs text-gray-400 ml-1">/MWh</span>
      </div>

      {/* Updated at */}
      <div className="text-xs text-gray-400">
        {formattedTime !== '—' ? `Updated ${formattedTime} AEST` : 'Awaiting data…'}
      </div>
    </div>
  )
}
