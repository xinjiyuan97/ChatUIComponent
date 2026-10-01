import { createAgentServer } from './server.ts'

const port = Number(process.env.PORT ?? 3210)
const server = createAgentServer()
server.on('error', (error: NodeJS.ErrnoException) => { if (error.code === 'EADDRINUSE') { console.error(`Agent server port ${port} is already in use`); process.exitCode = 1 } else console.error(error) })
server.listen(port, '127.0.0.1', () => console.log(`agent server listening at http://127.0.0.1:${port}`))
