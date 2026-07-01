import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { loginBodySchema, registerBodySchema } from '@wordforge/shared'
import { AuthError, issueRefreshToken, registerUser, rotateRefreshToken, verifyUser } from '../modules/auth'
import { config } from '../app/config'

export const REFRESH_COOKIE = 'refresh_token'

function setRefreshCookie(reply: FastifyReply, token: string, expiresAt: string) {
  reply.setCookie(REFRESH_COOKIE, token, {
    path: '/api/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    expires: new Date(expiresAt),
  })
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/register', async (request, reply) => {
    const parsed = registerBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message })
    }

    const { userId } = await registerUser(app.db, parsed.data.email, parsed.data.password)
    const refresh = issueRefreshToken(app.db, userId)
    const accessToken = await reply.jwtSign({ sub: userId })

    setRefreshCookie(reply, refresh.token, refresh.expiresAt)
    return reply.status(201).send({ accessToken })
  })

  app.post('/login', async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ message: parsed.error.issues[0].message })
    }

    const { userId } = await verifyUser(app.db, parsed.data.email, parsed.data.password)
    const refresh = issueRefreshToken(app.db, userId)
    const accessToken = await reply.jwtSign({ sub: userId })

    setRefreshCookie(reply, refresh.token, refresh.expiresAt)
    return reply.status(200).send({ accessToken })
  })

  app.post('/refresh', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE]
    if (!token) {
      throw new AuthError(401, 'Сессия истекла, войдите снова')
    }

    const rotated = rotateRefreshToken(app.db, token)
    const accessToken = await reply.jwtSign({ sub: rotated.userId })

    setRefreshCookie(reply, rotated.token, rotated.expiresAt)
    return reply.status(200).send({ accessToken })
  })
}
