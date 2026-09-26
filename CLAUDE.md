This is a public repository. Take extra care not to expose secrets, personal information or work information. Keep the commit history clean of them as well.

## Working with documentation

Do all work based on the documentation of the tools the current task involves. Once you understand the task, read the relevant documentation, then start working. Consult it again after each chunk of work and whenever you face a design decision. Follow the structure, guidance and APIs the documentation recommends; never work by best effort.

- NestJS: https://docs.nestjs.com/llms.txt
- React: https://react.dev/llms.txt
- Pipecat: https://docs.pipecat.ai/llms.txt
- Pipecat FastAPI integration: https://docs.pipecat.ai/api-reference/server/services/transport/fastapi-websocket.md
- Pipecat React SDK: https://docs.pipecat.ai/api-reference/client/react/overview.md
- FastAPI: https://fastapi.tiangolo.com/
- just: https://just.systems/man/en/

## Development

- Build every feature end to end across all apps it touches, so it can be seen working.
- Work strictly in a git worktree and open a pull request when the work is done, without asking first.
- Never write comments.
- Never write documentation.
- When the instructions in this file or the checks in the pre-commit hook contradict each other or leave no clean way forward, stop working and consult me. Briefly introduce the problem, then give me the cleanest option to fix it.
