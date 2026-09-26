set dotenv-load

[parallel]
dev: web core voice

[working-directory('apps/web')]
web:
    npm run dev -- --port 5173 --strictPort

[working-directory('apps/core')]
core:
    PORT=3000 npm run start:dev

[working-directory('apps/voice')]
voice:
    uv run fastapi dev src/voice/main.py --port 7860
