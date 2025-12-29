# Project Structure

```
gengar-bark-next/
├── pages/                    # Next.js pages and API routes
│   ├── api/                  # Backend API endpoints
│   │   ├── gengar/           # Main bot endpoints (events, messages, CI)
│   │   ├── hr/               # HR bot endpoints
│   │   ├── bob/              # Bob bot endpoints
│   │   ├── report/           # Annual report APIs
│   │   └── ci/               # CI notification webhooks
│   └── *.tsx                 # Frontend pages (index, guide, reports)
│
├── lib/                      # Core business logic
│   ├── ai/                   # AI provider integrations
│   │   ├── openai.ts         # OpenAI/GPT functions
│   │   ├── gemini.ts         # Google Gemini
│   │   └── maxkb-*.ts        # MaxKB knowledge base
│   │
│   ├── slack/                # Slack Bolt app instances
│   │   ├── gengar-bolt.ts    # Main bot client
│   │   ├── hr-bolt.ts        # HR bot client
│   │   └── slack.ts          # Shared utilities
│   │
│   ├── database/             # Data layer
│   │   ├── data-source.ts    # TypeORM configuration
│   │   ├── entities/         # TypeORM entity definitions
│   │   ├── services/         # Repository services
│   │   ├── supabase.ts       # Supabase client
│   │   └── redshift.ts       # Analytics queries
│   │
│   ├── events-handlers/      # Slack event processors
│   │   ├── chat.ts           # Message/mention handling
│   │   ├── team-join.ts      # New member onboarding
│   │   └── *.ts              # Other event handlers
│   │
│   ├── commands/             # Bot command definitions
│   │   ├── gengar-commands.ts # Main bot commands
│   │   └── hr-commands.ts    # HR bot commands
│   │
│   ├── slash-handlers/       # Slack slash command handlers
│   ├── utils/                # Shared utilities
│   └── [service]/            # External service integrations
│
├── components/               # React components
├── styles/                   # CSS (Tailwind, modules)
├── public/                   # Static assets
├── types/                    # TypeScript declarations
└── doc/                      # SQL scripts and documentation
```

## Key Patterns

### API Routes
- Located in `pages/api/` following Next.js conventions
- Bot-specific routes grouped by bot name (gengar, hr, bob)
- Use request signature verification for Slack webhooks

### Service Layer
- Services in `lib/database/services/` use singleton pattern via `getInstance()`
- Initialize database connection before use: `await initializeDatabase()`

### Command Pattern
- Bot commands implement a common interface with `matches()` and `execute()`
- Commands are processed in order; first match wins

### Event Handlers
- Each Slack event type has a dedicated handler in `lib/events-handlers/`
- Main router in `pages/api/gengar/event.ts` dispatches to handlers

### Entity Definitions
- TypeORM entities in `lib/database/entities/`
- Use decorators for column definitions
- snake_case for database columns
