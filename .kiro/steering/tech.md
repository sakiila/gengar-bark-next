# Tech Stack

## Framework & Runtime
- **Next.js 14** - React framework with API routes
- **TypeScript 5** - Strict mode enabled
- **Node.js 18+** - Runtime environment

## AI & LLM
- **OpenAI API** - GPT models, DALL-E 3
- **Google Generative AI** - Gemini models
- **MaxKB** - Custom knowledge base (CN/US regions)

## Database & Storage
- **PostgreSQL** - Primary database via TypeORM
- **Supabase** - Additional PostgreSQL instance with client SDK
- **AWS S3** - File storage
- **Upstash Redis** - Caching and rate limiting
- **Upstash Kafka/QStash** - Message queuing

## Slack Integration
- **@slack/bolt** - Slack app framework
- Request signature verification for security
- Multiple bot instances (Gengar, HR, Bob)

## Frontend
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Recharts** - Data visualization

## Monitoring
- **Next Axiom** - Logging and observability

## Common Commands

```bash
# Development
npm run dev      # Start dev server (port 3000)

# Build & Deploy
npm run build    # Production build
npm run start    # Start production server

# Code Quality
npm run lint     # ESLint check

# Docker
docker build -t gengar-bark .
docker run -p 3000:3000 gengar-bark
```

## Environment Variables

Key configurations required (see `.env.example`):
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` - Slack credentials
- `OPENAI_API_KEY`, `OPENAI_API_URL` - AI provider
- `POSTGRES_*` - Database connection
- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Supabase
- `UPSTASH_REDIS_*` - Redis caching

## TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` maps to project root
- Decorators enabled for TypeORM entities
