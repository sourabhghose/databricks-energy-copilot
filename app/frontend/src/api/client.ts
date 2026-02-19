// ---------------------------------------------------------------------------
// Typed API client for AUS Energy Copilot
// All requests are proxied through Vite → FastAPI backend at /api/*
// ---------------------------------------------------------------------------

export interface RegionPrice {
  region: string
  price: number
  trend: string
  updatedAt: string
}

export interface PricePoint {
  timestamp: string
  price: number
}

export interface ForecastPoint {
  timestamp: string
  predicted: number
  lower: number
  upper: number
}

export interface Alert {
  id: string
  region: string
  metric: string
  threshold: number
  status: string
  triggeredAt: string
}

export interface GenerationDataPoint {
  timestamp: string
  coal: number
  gas: number
  hydro: number
  wind: number
  solar: number
  battery: number
}

export interface InterconnectorFlow {
  id: string
  from: string
  to: string
  flowMw: number
  limitMw: number
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// API client object
// ---------------------------------------------------------------------------

export const api = {
  /**
   * Get the latest spot prices for all (or one) NEM region.
   */
  getLatestPrices(): Promise<RegionPrice[]> {
    return get<RegionPrice[]>('/api/prices/latest')
  },

  /**
   * Get 5-min or aggregated price history for a region over a time range.
   * @param region  NEM region code (NSW1, QLD1, VIC1, SA1, TAS1)
   * @param start   ISO-8601 datetime string
   * @param end     ISO-8601 datetime string
   */
  getPriceHistory(region: string, start: string, end: string): Promise<PricePoint[]> {
    const params = new URLSearchParams({ region, start, end })
    return get<PricePoint[]>(`/api/prices/history?${params}`)
  },

  /**
   * Get price forecasts for a region at a specific horizon.
   * @param region  NEM region code
   * @param horizon One of: "1hr" | "4hr" | "24hr"
   */
  getForecasts(region: string, horizon: string): Promise<ForecastPoint[]> {
    const params = new URLSearchParams({ region, horizon })
    return get<ForecastPoint[]>(`/api/forecasts?${params}`)
  },

  /**
   * Get generation mix (MW by fuel type) for a region over a time range.
   */
  getGeneration(region: string, start: string, end: string): Promise<GenerationDataPoint[]> {
    const params = new URLSearchParams({ region, start, end })
    return get<GenerationDataPoint[]>(`/api/generation?${params}`)
  },

  /**
   * Get current interconnector flows across the NEM.
   */
  getInterconnectors(): Promise<InterconnectorFlow[]> {
    return get<InterconnectorFlow[]>('/api/interconnectors')
  },

  /**
   * Get active and recently triggered alerts.
   */
  getAlerts(): Promise<Alert[]> {
    return get<Alert[]>('/api/alerts')
  },

  /**
   * Send a chat message to the Copilot agent.
   * Returns an EventSource for SSE streaming (text/event-stream).
   * Each event carries `data: {"delta": "..."}` or `data: [DONE]`.
   *
   * The caller is responsible for calling `eventSource.close()` when done.
   *
   * Note: EventSource only supports GET requests natively. For POST + SSE
   * we use the fetch API with streaming in ChatInterface.tsx instead.
   * This method is provided for convenience when a GET endpoint is available.
   *
   * @param message  The user's message text
   * @param history  Prior conversation turns [{ role, content }, …]
   */
  sendChat(
    message: string,
    history: { role: string; content: string }[]
  ): EventSource {
    // Encode payload in query string (base64) for GET-based SSE.
    // The FastAPI backend accepts either GET /api/chat?payload=<b64> or
    // POST /api/chat with JSON body — the ChatInterface component uses
    // the POST + fetch approach for richer control; this method covers
    // the EventSource (GET) approach.
    const payload = btoa(
      JSON.stringify({ message, history })
    )
    return new EventSource(`/api/chat?payload=${encodeURIComponent(payload)}`)
  },
}
