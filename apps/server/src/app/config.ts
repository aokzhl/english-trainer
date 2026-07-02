export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  databaseUrl:
    process.env.DATABASE_URL ??
    'postgres://wordforge:wordforge@localhost:5432/wordforge',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  isProd: process.env.NODE_ENV === 'production',
}
