# tensors-web

Web UI for searching AI models on CivitAI/HuggingFace and generating images with Stable Diffusion.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Browser ──► tensors.saiden.dev (Cloudflare Pages)                      │
│                      │                                                  │
│                      ▼                                                  │
│              tensors-proxy.saiden.dev (Cloudflare Worker)               │
│                      │  (adds X-API-Key header server-side)             │
│                      ▼                                                  │
│              tensors-api.saiden.dev (Cloudflare Tunnel)                 │
│                      │                                                  │
│                      ▼                                                  │
│              junkpile:51200 (tsr serve - FastAPI)                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                              DEVELOPMENT                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Browser ──► localhost:5173 (Vite dev server)                           │
│                      │                                                  │
│                      ▼                                                  │
│              tensors-api.saiden.dev (direct, with API key in .env)      │
│                      │                                                  │
│                      ▼                                                  │
│              junkpile:51200 (via Cloudflare Tunnel)                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## URLs

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production Web** | https://tensors.saiden.dev | Cloudflare Pages (custom domain) |
| **Production Proxy** | https://tensors-proxy.saiden.dev | Worker proxy (adds API key) |
| **Production API** | https://tensors-api.saiden.dev | Cloudflare Tunnel to junkpile |
| **Development** | http://localhost:5173 | Vite dev server |
| **Junkpile Direct** | http://junkpile:51200 | LAN access (if configured) |

## Development

```bash
# Install dependencies
npm install

# Start dev server (uses .env for API config)
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

### Environment Variables

`.env` for local development:
```bash
VITE_API_URL=https://tensors-api.saiden.dev
VITE_API_KEY=<your-api-key>
```

Production (Cloudflare Pages) uses the proxy, so no API key in frontend.

## Deployment

### Cloudflare Pages

**IMPORTANT**: The project uses `main` as the production branch, not `master`.

```bash
# Build
npm run build

# Deploy to PRODUCTION (must use --branch=main)
wrangler pages deploy dist --project-name=tensors-web --branch=main --commit-dirty=true

# Deploy to preview (any other branch name)
wrangler pages deploy dist --project-name=tensors-web --commit-dirty=true
```

### Wrangler Commands

```bash
# List Pages projects
wrangler pages project list

# List deployments (see which is production vs preview)
wrangler pages deployment list --project-name tensors-web

# List only production deployments
wrangler pages deployment list --project-name tensors-web --environment production

# Deploy Worker proxy
cd worker
wrangler deploy

# Set Worker secret (API key)
cd worker
wrangler secret put TENSORS_API_KEY
```

### Wrangler Gotchas

1. **Production vs Preview**: Cloudflare Pages uses `main` as the default production branch. Deploying from `master` goes to Preview, NOT Production. The custom domain only serves Production.

2. **Custom domains**: Custom domain `tensors.saiden.dev` points to Production. Preview deployments get URLs like `35384b7b.tensors-web.pages.dev`.

3. **`--commit-dirty`**: Add this flag when deploying uncommitted changes to avoid warnings.

4. **Cache**: After deploying, the site might serve cached content. Add `?v=N` query param to bust cache for testing.

## Worker Proxy

The Worker (`worker/`) proxies API requests and adds the API key server-side:

```
worker/
├── src/index.ts    # Worker code
└── wrangler.toml   # Worker config
```

**CORS Headers**: The worker must allow `X-API-Key` in CORS:
```typescript
'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization'
```

**Deploy worker**:
```bash
cd worker
wrangler secret put TENSORS_API_KEY  # Set the API key secret
wrangler deploy
```

## Debugging

### Models Not Showing in Dropdown

**Symptom**: MODEL dropdown shows "No data available"

**Cause**: API returns raw array `[...]` but code expected `{items: [...]}`.

**Fix**: Check `src/stores/app.ts` - ensure response handling works for both formats:
```typescript
models.value = Array.isArray(modelsRes) ? modelsRes : (modelsRes.items || [])
```

### CORS Errors

**Symptom**: `Request header field X-API-Key is not allowed by Access-Control-Allow-Headers`

**Cause**: Worker proxy not allowing the header in CORS preflight.

**Fix**: Update `worker/src/index.ts` CORS headers to include `X-API-Key`.

### Search Returns "No models found"

**Symptom**: Search executes but returns empty results.

**Check**:
1. Browser DevTools Network tab - is API returning data?
2. Console errors?
3. Response structure - check if parsing expects wrong format.

### Deployment Goes to Preview Instead of Production

**Symptom**: Deployed but custom domain still shows old version.

**Cause**: Deployed to `master` branch, but Pages production branch is `main`.

**Fix**: Deploy with `--branch=main`:
```bash
wrangler pages deploy dist --project-name=tensors-web --branch=main
```

### How to Debug

1. **Browser DevTools**:
   - Network tab: Check API requests/responses
   - Console: Check for errors
   - Use headed browser mode for debugging: `mcp__browse__launch` with `headed: true`

2. **Check deployment status**:
   ```bash
   wrangler pages deployment list --project-name tensors-web --environment production
   ```

3. **Verify API directly**:
   ```bash
   curl -s "https://tensors-api.saiden.dev/api/db/models?type=Checkpoint&api_key=KEY"
   curl -s "https://tensors-proxy.saiden.dev/api/db/models?type=Checkpoint" -H "X-API-Key: KEY"
   ```

4. **Check tunnel status** (on junkpile):
   ```bash
   ssh chi@junkpile "systemctl status cloudflared"
   ssh chi@junkpile "curl -s http://localhost:51200/status"
   ```

## API Client

Uses `@saiden/tensors` npm package (generated from OpenAPI spec):

```typescript
import { databaseApi, searchApi } from '@/api/client'

// Search models
const results = await searchApi.searchModelsApiSearchGet({ query: 'flux' })

// Get local models from database
const models = await databaseApi.searchModelsApiDbModelsGet({ type: 'Checkpoint' })
```

**Note**: API responses may be raw arrays OR `{items: [...]}` depending on endpoint. Always handle both.

## Project Structure

```
tensors-web/
├── src/
│   ├── api/
│   │   ├── client.ts      # API client instances
│   │   └── config.ts      # API configuration
│   ├── components/
│   │   ├── GenerateView.vue   # Image generation
│   │   ├── SearchView.vue     # Model search
│   │   └── GalleryView.vue    # Image gallery
│   ├── stores/
│   │   └── app.ts         # Pinia store
│   └── types/
│       └── index.ts       # TypeScript types
├── worker/                # Cloudflare Worker proxy
│   ├── src/index.ts
│   └── wrangler.toml
├── dist/                  # Build output (for Pages)
├── .env                   # Local dev config (gitignored)
├── .env.example           # Example env file
└── vite.config.ts         # Vite config
```

## Related Projects

- [tensors](https://github.com/saiden-dev/tensors) - Python CLI and API server (runs on junkpile)
- [tensors-typescript](https://github.com/saiden-dev/tensors-typescript) - TypeScript API client (@saiden/tensors)
