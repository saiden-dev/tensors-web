<p align="center">
  <img src="icon.svg" alt="tensors-web" width="96" height="96">
</p>

<h1 align="center">tensors-web</h1>

<p align="center">
  <img src="https://img.shields.io/badge/vue-3.x-brightgreen" alt="Vue 3">
  <img src="https://img.shields.io/badge/vuetify-3.x-blue" alt="Vuetify 3">
  <img src="https://img.shields.io/badge/vite-7.x-purple" alt="Vite">
  <a href="https://github.com/saiden-dev/tensors-web/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
</p>

<p align="center">
  Web UI for searching AI models on CivitAI and Hugging Face, and generating images with Stable Diffusion.
</p>

## Features

- **Unified Model Search** - Search across CivitAI and Hugging Face from one interface
- **Filter & Sort** - Filter by model type, base model, and sort by downloads/rating/newest
- **Image Generation** - Generate images using stable-diffusion.cpp backend
- **Model Management** - Browse checkpoints and LoRAs, switch active models
- **Gallery** - View and manage generated images
- **Download Queue** - Track model downloads in progress

## Live Demo

**https://tensors.saiden.dev**

## Tech Stack

- **Vue 3** - Composition API with `<script setup>`
- **Vuetify 3** - Material Design component framework
- **Vite** - Fast build tooling
- **TypeScript** - Type-safe development
- **OpenAPI Generator** - Auto-generated API client

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Type check
npm run type-check
```

## Configuration

Environment variables (`.env`):

```bash
VITE_API_URL=https://tensors-api.saiden.dev  # API endpoint
VITE_API_KEY=your-api-key                     # Optional: API key
```

## Deployment

### Cloudflare Pages

```bash
npm run build
wrangler pages deploy dist --project-name=tensors-web
```

### Docker

```bash
docker build -t tensors-web .
docker run -p 8080:80 tensors-web
```

## API Proxy (Optional)

For production deployments, use the included Cloudflare Worker to proxy API requests and keep your API key server-side:

```bash
cd worker
wrangler secret put TENSORS_API_KEY
wrangler deploy
```

## Related Projects

- [tensors](https://github.com/saiden-dev/tensors) - Python CLI and API server
- [tensors-typescript](https://github.com/saiden-dev/tensors-typescript) - TypeScript API client

## License

MIT
