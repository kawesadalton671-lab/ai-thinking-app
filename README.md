# AI Thinking App

A more advanced AI thinking workspace for brainstorming, deciding, planning, and analyzing complex topics with structured insight generation and project-based organization.

## Features
- Prompt-based workspace with dynamic reasoning modes
- AI-powered generation via OpenAI-compatible API with graceful local fallback
- Thinking profiles: Balanced, Ambitious, and Cautious
- Smart prompt templates and strategic workspace management
- Project-based session tracking with saved workspaces
- Recent project dashboard and session metrics
- Exportable Markdown notes
- Responsive dashboard layout

## Local development

```bash
npm install
npm run dev
```

This starts the Vite frontend and the Express API together.

## Environment

Create a `.env` file in the project root with:

```bash
OPENAI_API_KEY=your_api_key_here
PORT=4000
```

If no API key is configured, the app still works with its built-in local reasoning logic.

## Production build

```bash
npm run build
```

## Run the production server

```bash
npm start
```
