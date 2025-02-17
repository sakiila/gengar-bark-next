# Gengar Bark - AI-Powered Slack Bot

[![Website](https://img.shields.io/badge/Website-pearl.baobo.me-blue)](https://pearl.baobo.me)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Slack](https://img.shields.io/badge/Slack-Bot-4A154B)](https://api.slack.com/bot-users)

Gengar Bark is an intelligent Slack bot that enhances team communication and productivity through AI-powered features. With advanced natural language processing capabilities, it helps teams better manage conversations and extract insights from their Slack workspace.

## 🌟 Key Features

- **AI Chat Integration**: Engage in natural conversations with the bot powered by advanced AI models
- **Context Summarization**: Automatically summarize long conversations and discussions
- **Smart Responses**: Get intelligent responses based on conversation context
- **Web Interface**: Beautiful web dashboard for configuration and analytics at [pearl.baobo.me](https://pearl.baobo.me)

## 🛠️ Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **AI Integration**: OpenAI API
- **Database**: PostgreSQL (via TypeORM)
- **Caching**: Upstash Redis
- **Message Queue**: Upstash Kafka
- **Storage**: AWS S3
- **UI**: Tailwind CSS, Framer Motion
- **Monitoring**: Next Axiom

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL database
- Slack App credentials
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/gengar-bark-next.git
cd gengar-bark-next
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment variables file and configure it:
```bash
cp .env.example .env.local
```

4. Configure the required environment variables in `.env.local`

5. Run the development server:
```bash
npm run dev
```

## 🔧 Configuration

The bot requires several environment variables to be set. Key configurations include:

- Slack Bot Token
- Slack App Token
- OpenAI API Key
- Database Connection Details
- Redis Configuration
- AWS S3 Credentials

Refer to `.env.example` for all required environment variables.

## 🌐 Deployment

The project includes Docker support for easy deployment. You can deploy using:

```bash
docker build -t gengar-bark .
docker run -p 3001:3001 gengar-bark
```

## 📝 License

This project is licensed under the terms of the license included in the repository.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions and support, please reach out through the project's GitHub issues or contact the maintainers directly.

---

Made with ❤️ by the Gengar Bark team
