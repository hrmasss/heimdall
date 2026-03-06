# Heimdall

> Centralized Social Media Management Platform

Heimdall is a SaaS platform for centralizing and automating social media management. It brings platforms like Facebook, X (Twitter), Instagram, LinkedIn, TikTok, YouTube and more into one unified dashboard.

## Features

- **Multi-Platform Management** - Connect and manage all your social accounts from one place
- **Content Planning** - Create variations of posts for different platforms
- **Smart Scheduling** - Schedule posts with AI-powered optimal time suggestions
- **Unified Analytics** - Analyze performance across all channels in one dashboard
- **AI Content Generation** - Generate posts, captions, and media with AI assistance
- **Team Collaboration** - Work together with approval workflows and permissions
- **Automation Rules** - Set up intelligent automation for posting and engagement

## Tech Stack

### Backend
- **Go 1.24** - Fast, reliable backend with excellent concurrency
- **Fiber v3** - Express-inspired web framework for Go
- **Bun ORM** - SQL-first ORM for PostgreSQL
- **River** - Background job processing (future)
- **LangChain/LangGraph** - AI orchestration (future)

### Frontend
- **React 19** - UI library
- **Vite 6** - Build tool with hot reload
- **Tailwind CSS 4** - Utility-first CSS
- **shadcn/ui** - Component library
- **React Router 7** - Client-side routing
- **Biome** - Linting and formatting

### Infrastructure
- **PostgreSQL** - Primary database
- **Redis** - Caching and job queues (future)

## Getting Started

### Prerequisites

- Go 1.24+
- Node.js 20+
- PostgreSQL 15+

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/heimdall.git
   cd heimdall
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies**
   ```bash
   # Install Node dependencies
   npm install
   
   # Install Go dependencies
   cd apps/api && go mod tidy
   ```

4. **Start development servers**
   ```bash
   npm run dev
   ```

   This starts both the API server (http://localhost:8080) and the web app (http://localhost:5173) with hot reload.

### Development URLs

| Service | URL |
|---------|-----|
| Web App | http://localhost:5173 |
| API Server | http://localhost:8080 |
| API Reference | http://localhost:8080/reference |
| OpenAPI Spec | http://localhost:8080/openapi.yaml |
| Health Check | http://localhost:8080/api/v1/health |

## Project Structure

```
heimdall/
├── apps/
│   ├── api/                    # Go backend
│   │   ├── cmd/
│   │   │   └── server/         # Main entry point
│   │   ├── internal/
│   │   │   ├── config/         # Configuration
│   │   │   ├── handlers/       # HTTP handlers
│   │   │   ├── middleware/     # Middleware
│   │   │   ├── services/       # Business logic
│   │   │   └── database/       # Database layer
│   │   └── go.mod
│   │
│   └── web/                    # React frontend
│       ├── src/
│       │   ├── components/     # UI components
│       │   ├── pages/          # Page components
│       │   ├── lib/            # Utilities
│       │   └── main.tsx        # Entry point
│       ├── package.json
│       └── vite.config.ts
│
├── .env                        # Environment variables
├── .env.example                # Example environment
├── package.json                # Root package (monorepo scripts)
└── README.md
```

## API Documentation

The API follows OpenAPI 3.1 specification. You can:

- View interactive documentation at http://localhost:8080/reference
- Download the OpenAPI spec at http://localhost:8080/openapi.yaml

### Quick API Test

```bash
# Health check
curl http://localhost:8080/api/v1/health
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both API and web in development mode |
| `npm run dev:api` | Start only the API server |
| `npm run dev:web` | Start only the web app |
| `npm run build` | Build both API and web for production |
| `npm run lint` | Lint the frontend code |
| `npm run format` | Format the frontend code |
| `npm run typecheck` | Type check the frontend |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_HOST` | API server host | `localhost` |
| `API_PORT` | API server port | `8080` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `VITE_API_URL` | API URL for frontend | `http://localhost:8080` |
| `VITE_APP_NAME` | Application name | `Heimdall` |

See `.env.example` for all available variables.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ by the Heimdall team
