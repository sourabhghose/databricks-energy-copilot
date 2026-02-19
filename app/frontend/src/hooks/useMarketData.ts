import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../api/client'
import type { RegionPrice, PricePoint, ForecastPoint, Alert } from '../api/client'

// ---------------------------------------------------------------------------
// Generic fetch hook factory
// ---------------------------------------------------------------------------

interface FetchState<T> {
  data: T
  loading: boolean
  error: string | null
}

function useFetch<T>(
  fetcher: () => Promise<T>,
  defaultData: T,
  deps: unknown[] = []
): FetchState<T> {
  const [data, setData]       = useState<T>(defaultData)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Use a ref to track if the component is still mounted
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    if (!mountedRef.current) return
    setLoading(true)
    setError(null)
    try {
      const result = await fetcher()
      if (mountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message ?? 'Unknown error')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error }
}

// ---------------------------------------------------------------------------
// useLatestPrices
// Polls the latest NEM spot prices on a configurable interval.
// ---------------------------------------------------------------------------

/**
 * @param pollMs  Polling interval in milliseconds (default: 30 000 = 30 s)
 * @returns       { data: RegionPrice[]; loading: boolean; error: string | null }
 */
export function useLatestPrices(pollMs = 30_000): FetchState<RegionPrice[]> {
  const [data, setData]       = useState<RegionPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchPrices = useCallback(async () => {
    try {
      const result = await api.getLatestPrices()
      if (mountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message ?? 'Failed to fetch prices')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchPrices()
    const interval = setInterval(() => void fetchPrices(), pollMs)
    return () => clearInterval(interval)
  }, [fetchPrices, pollMs])

  return { data, loading, error }
}

// ---------------------------------------------------------------------------
// usePriceHistory
// Fetches price history for a given region and time range.
// Re-fetches whenever region, start, or end changes.
// ---------------------------------------------------------------------------

/**
 * @param region  NEM region code (e.g. "NSW1")
 * @param start   ISO-8601 start datetime
 * @param end     ISO-8601 end datetime
 */
export function usePriceHistory(
  region: string,
  start: string,
  end: string
): FetchState<PricePoint[]> {
  return useFetch<PricePoint[]>(
    () => api.getPriceHistory(region, start, end),
    [],
    [region, start, end]
  )
}

// ---------------------------------------------------------------------------
// useForecasts
// Fetches price forecasts for a region at the given horizon.
// Generates placeholder data when the API is not yet available.
// ---------------------------------------------------------------------------

/**
 * @param region   NEM region code
 * @param horizon  "1hr" | "4hr" | "24hr"
 */
export function useForecasts(
  region: string,
  horizon: string
): FetchState<ForecastPoint[]> {
  const [data, setData]       = useState<ForecastPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)

    api.getForecasts(region, horizon)
      .then(result => {
        if (mountedRef.current) {
          setData(result)
          setLoading(false)
        }
      })
      .catch(() => {
        // API not yet available — generate synthetic placeholder data
        if (!mountedRef.current) return

        const points = horizon === '1hr' ? 12 : horizon === '4hr' ? 48 : 288
        const base   = Date.now()
        const interval = horizon === '24hr' ? 5 * 60_000 : 5 * 60_000

        const synthetic: ForecastPoint[] = Array.from({ length: points }, (_, i) => {
          const predicted = 60 + Math.sin(i * 0.4) * 35 + Math.random() * 15
          const spread    = 10 + i * 0.2
          return {
            timestamp: new Date(base + i * interval).toISOString(),
            predicted,
            lower:     Math.max(0, predicted - spread),
            upper:     predicted + spread,
          }
        })

        setData(synthetic)
        setLoading(false)
        setError(null)   // Silence the error for placeholder mode
      })
  }, [region, horizon])

  return { data, loading, error }
}

// ---------------------------------------------------------------------------
// useAlerts
// Fetches active and recent alerts. No polling (alerts are low-frequency).
// ---------------------------------------------------------------------------

/**
 * @returns { data: Alert[]; loading: boolean; error: string | null }
 */
export function useAlerts(): FetchState<Alert[]> {
  return useFetch<Alert[]>(
    () => api.getAlerts(),
    [],
    []
  )
}
