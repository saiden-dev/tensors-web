interface Env {
  TENSORS_API_KEY: string
}

const UPSTREAM = 'https://tensors-api.saiden.dev'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const upstream = new URL(url.pathname + url.search, UPSTREAM)

    // Forward request with API key
    const response = await fetch(upstream.toString(), {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.TENSORS_API_KEY,
      },
      body: request.method !== 'GET' ? request.body : undefined,
    })

    // Return with CORS headers
    const headers = new Headers(response.headers)
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v))

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  },
}
