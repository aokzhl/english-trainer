export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  dbPath: process.env.DB_PATH ?? './data/wordforge.db',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  isProd: process.env.NODE_ENV === 'production',
}
