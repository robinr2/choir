set dotenv-load

[parallel]
dev: web core voice

[working-directory('apps/web')]
web:
    npm run dev -- --port 5173 --strictPort < /dev/null

[working-directory('apps/core')]
core:
    PORT=3000 npm run start:dev

[working-directory('apps/voice')]
voice:
    uv run fastapi dev src/voice/main.py --port 7860

# Mutation-test only the given paths. A path is a relative path to a file or a directory. Always narrow the scope to the code you changed; a full run takes very long.
[arg('paths', help='relative paths to files or directories')]
mutate +paths:
    ./scripts/mutate.sh {{paths}}
