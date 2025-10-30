# Gengar Bark - AI Slack Bot Copilot Instructions

## Architecture Overview

This is a Next.js 14 TypeScript project that creates an AI-powered Slack bot with dual interfaces:
- **API endpoints** (`pages/api/`) handle Slack events, slash commands, and webhooks
- **Web interface** (`pages/`) provides analytics and configuration dashboard at [pearl.baobo.me](https://pearl.baobo.me)

## Key Architectural Patterns

### Command Pattern Implementation
All bot commands follow the Command interface in `lib/commands/command.ts`:
```typescript
export interface Command {
  matches(text: string): boolean;
  execute(text: string): Promise<void>;
}
```
- Commands are organized by domain: `gengar-commands.ts` (core features), `hr-commands.ts` (HR-specific)
- Each command class handles pattern matching and execution logic
- Commands are injected with context (channel, timestamp, userId) via constructor

### Slack Integration Architecture
- **Primary bot**: `lib/slack/gengar-bolt.ts` using @slack/bolt framework
- **Event handling**: `pages/api/gengar/event.ts` processes all Slack events with proper verification
- **Multiple token types**: Bot tokens and user tokens for different API scopes
- **Custom message formatting**: Functions like `sendMessageWithCustomization()` for branded responses

### AI Service Layer
- **Multi-provider support**: OpenAI (`lib/ai/openai.ts`), Gemini (`lib/ai/gemini.ts`), MaxKB (`lib/ai/maxkb-*.ts`)
- **Context-aware prompting**: `generatePromptFromThread()` builds conversation context from Slack threads
- **Specialized functions**: Translation, image generation, different model tiers (GPT-4, GPT-4-mini)

### Database & Caching Strategy
- **TypeORM**: PostgreSQL entities in `lib/database/entities/` (BuildRecord, Channel)
- **Dual database**: Supabase for user data (`lib/database/supabase.ts`), TypeORM for bot-specific data
- **Redis caching**: Upstash Redis for rate limiting and temporary data
- **Message queuing**: Upstash Kafka for async processing (`lib/upstash/upstash.ts`)

## Development Workflows

### Environment Setup
```bash
npm run dev  # Starts with NODE_NO_WARNINGS=1 to suppress Node.js warnings
```

### Key Environment Variables
- Slack: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- AI: `OPENAI_API_KEY`, `OPENAI_API_URL` (custom endpoint support)
- Database: `POSTGRES_*` vars for TypeORM, Supabase credentials
- Cache/Queue: `UPSTASH_KAFKA_*` and `UPSTASH_REDIS_*` credentials

### Logging & Monitoring
- **Structured logging**: `lib/utils/logger.ts` using next-axiom
- **Request-scoped loggers**: Create with context in API handlers
- **Performance monitoring**: Configured in `next.config.js` with Axiom dataset

## Project-Specific Conventions

### Event Handler Pattern
Event handlers in `lib/events-handlers/` follow this pattern:
- Named after Slack event types (`channel-created.ts`, `user-status-changed.ts`)
- Export default async function taking event payload
- Handle specific business logic (channel monitoring, user onboarding, etc.)

### Service Layer Organization
- **Domain services**: `lib/services/` for business logic (ReportService for analytics)
- **Integration services**: `lib/database/services/` for data operations
- **External integrations**: Separate folders (`lib/jira/`, `lib/jenkins/`, `lib/moego/`)

### ID Utilities Pattern
`lib/utils/id-utils.ts` provides standardized ID extraction for different entity types:
- Appointment IDs, Order IDs with type safety
- Used across commands for consistent entity reference parsing

### Slash Command Routing
Slash commands defined in `manifest.yml` route to specific API endpoints:
- `/ai` → `pages/api/gengar/ai.ts`
- `/ci` → `pages/api/gengar/ci.ts`
- Each endpoint handles Slack's slash command payload format

## Integration Patterns

### External Services
- **Jira**: Issue creation with proper authentication (`lib/jira/create-issue.ts`)
- **Jenkins**: Build monitoring and notifications (`lib/jenkins/build.ts`)
- **MoeGo**: Appointment system integration (`lib/moego/`)
- **AWS S3**: File storage with SDK v3 (`@aws-sdk/client-s3`)

### Slack App Permissions
Defined in `manifest.yml`:
- Bot scopes for message posting, channel reading
- User scopes for profile access
- Webhook URLs point to Vercel deployment

## Deployment Notes

- **Docker**: Multi-stage build optimized for production
- **Next.js standalone**: Configured for containerized deployment
- **Vercel**: Primary deployment target with automatic SSL
- **Database initialization**: TypeORM auto-sync enabled for development

When adding new features, follow the established patterns: create command classes, add event handlers for Slack events, use the service layer for business logic, and ensure proper logging throughout.