interface Env {
  TENSORS_API_KEY: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  SESSION_SECRET: string
  GITHUB_ALLOWED_USERS: string // comma-separated
}

const UPSTREAM = 'https://tensors-api.saiden.dev'
const SESSION_MAX_AGE = 86400 * 7 // 7 days
const COOKIE_DOMAIN = '.saiden.dev'

// CORS headers - must use specific origin for credentials
function getCorsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || 'https://tensors.saiden.dev'
  // Allow saiden.dev origins and localhost for development
  const isAllowed = origin.endsWith('.saiden.dev')
    || origin === 'https://saiden.dev'
    || origin.startsWith('http://localhost:')
    || origin.startsWith('http://127.0.0.1:')

  const allowedOrigin = isAllowed ? origin : 'https://tensors.saiden.dev'

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Simple HMAC-like signing using Web Crypto
async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

async function createSessionToken(username: string, secret: string): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  const data = `${username}:${expires}`
  const signature = await sign(data, secret)
  return `${data}:${signature}`
}

async function verifySessionToken(token: string | null, secret: string): Promise<string | null> {
  if (!token) return null
  try {
    const parts = token.split(':')
    if (parts.length !== 3) return null
    const [username, expiresStr, signature] = parts
    const expires = parseInt(expiresStr, 10)
    if (Date.now() / 1000 > expires) return null
    const data = `${username}:${expiresStr}`
    const expected = await sign(data, secret)
    if (signature !== expected) return null
    return username
  } catch {
    return null
  }
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setSessionCookie(token: string): string {
  return `tensors_session=${encodeURIComponent(token)}; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=${SESSION_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
}

function clearSessionCookie(): string {
  return `tensors_session=; Path=/; Domain=${COOKIE_DOMAIN}; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}

// OAuth state storage using KV would be better, but for simplicity we'll encode state in the URL
function generateState(returnUrl: string): string {
  const data = { returnUrl, nonce: crypto.randomUUID(), ts: Date.now() }
  return btoa(JSON.stringify(data))
}

function parseState(state: string): { returnUrl: string; nonce: string; ts: number } | null {
  try {
    const data = JSON.parse(atob(state))
    // Check state is not too old (10 minutes)
    if (Date.now() - data.ts > 600000) return null
    return data
  } catch {
    return null
  }
}

const LOGIN_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tensors - Login</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e0e0e0;
    }
    .container {
      background: rgba(30, 30, 46, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 40px;
      width: 100%;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .logo { margin-bottom: 24px; }
    .logo svg { width: 64px; height: 64px; }
    h1 {
      font-size: 28px;
      font-weight: 600;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 32px; }
    .github-btn {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      background: #24292f;
      color: #fff;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-decoration: none;
    }
    .github-btn:hover {
      background: #32383f;
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -10px rgba(0, 0, 0, 0.5);
    }
    .github-btn svg { width: 20px; height: 20px; fill: currentColor; }
    .error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #f87171;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .footer { margin-top: 24px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <svg viewBox="0 0 128 128">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea"/>
            <stop offset="100%" style="stop-color:#764ba2"/>
          </linearGradient>
        </defs>
        <circle cx="64" cy="64" r="52" fill="none" stroke="url(#grad)" stroke-width="8" stroke-linecap="round"/>
        <line x1="28" y1="28" x2="100" y2="100" stroke="url(#grad)" stroke-width="8" stroke-linecap="round"/>
        <line x1="100" y1="28" x2="28" y2="100" stroke="url(#grad)" stroke-width="8" stroke-linecap="round"/>
      </svg>
    </div>
    <h1>Tensors</h1>
    <p class="subtitle">Sign in to continue</p>
    {{ERROR}}
    <a href="{{AUTH_URL}}" class="github-btn">
      <svg viewBox="0 0 16 16">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
      Sign in with GitHub
    </a>
    <div class="footer">Powered by tensors</div>
  </div>
</body>
</html>`

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Auth routes
    if (path === '/auth/login') {
      const returnUrl = url.searchParams.get('return_url') || 'https://tensors.saiden.dev'
      const error = url.searchParams.get('error')
      const state = generateState(returnUrl)
      const authUrl = `/auth/github?state=${encodeURIComponent(state)}`

      let html = LOGIN_PAGE
        .replace('{{AUTH_URL}}', authUrl)
        .replace('{{ERROR}}', error ? `<div class="error">${error}</div>` : '')

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (path === '/auth/github') {
      const state = url.searchParams.get('state') || generateState('https://tensors.saiden.dev')

      if (!env.GITHUB_CLIENT_ID) {
        return Response.redirect(`${url.origin}/auth/login?error=GitHub+OAuth+not+configured`, 303)
      }

      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/auth/callback`,
        scope: 'read:user',
        state,
      })

      return Response.redirect(`https://github.com/login/oauth/authorize?${params}`, 303)
    }

    if (path === '/auth/callback') {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      const stateData = state ? parseState(state) : null
      const returnUrl = stateData?.returnUrl || 'https://tensors.saiden.dev'

      if (!code) {
        return Response.redirect(`${url.origin}/auth/login?error=No+authorization+code&return_url=${encodeURIComponent(returnUrl)}`, 303)
      }

      // Exchange code for token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      })

      const tokenData = await tokenRes.json() as any
      if (tokenData.error) {
        return Response.redirect(`${url.origin}/auth/login?error=${encodeURIComponent(tokenData.error_description || 'OAuth error')}&return_url=${encodeURIComponent(returnUrl)}`, 303)
      }

      // Get user info
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'tensors-web',
        },
      })

      const userData = await userRes.json() as any
      const username = userData.login

      if (!username) {
        return Response.redirect(`${url.origin}/auth/login?error=Could+not+get+GitHub+username&return_url=${encodeURIComponent(returnUrl)}`, 303)
      }

      // Check allowed users
      const allowedUsers = env.GITHUB_ALLOWED_USERS?.split(',').map(u => u.trim().toLowerCase()).filter(Boolean) || []
      if (allowedUsers.length > 0 && !allowedUsers.includes(username.toLowerCase())) {
        return Response.redirect(`${url.origin}/auth/login?error=User+not+authorized&return_url=${encodeURIComponent(returnUrl)}`, 303)
      }

      // Create session
      const token = await createSessionToken(username, env.SESSION_SECRET)

      // Redirect to return URL with cookie
      return new Response(null, {
        status: 303,
        headers: {
          'Location': returnUrl,
          'Set-Cookie': setSessionCookie(token),
        },
      })
    }

    if (path === '/auth/verify') {
      const token = url.searchParams.get('token') || getCookie(request, 'tensors_session')
      const username = await verifySessionToken(token, env.SESSION_SECRET)

      if (username) {
        return new Response(JSON.stringify({ valid: true, username }), {
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
        })
      }
      return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
      })
    }

    if (path === '/auth/logout') {
      const returnUrl = url.searchParams.get('return_url') || 'https://tensors.saiden.dev'
      return new Response(null, {
        status: 303,
        headers: {
          'Location': returnUrl,
          'Set-Cookie': clearSessionCookie(),
        },
      })
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders(request) })
    }

    // Verify session for API routes (require authentication)
    if (path.startsWith('/api/')) {
      const token = getCookie(request, 'tensors_session')
      const username = await verifySessionToken(token, env.SESSION_SECRET)
      if (!username) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(request) },
        })
      }
    }

    // Proxy to upstream API
    const upstream = new URL(url.pathname + url.search, UPSTREAM)

    const response = await fetch(upstream.toString(), {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': env.TENSORS_API_KEY,
      },
      body: request.method !== 'GET' ? request.body : undefined,
    })

    const headers = new Headers(response.headers)
    const cors = getCorsHeaders(request)
    Object.entries(cors).forEach(([k, v]) => headers.set(k, v))

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  },
}
