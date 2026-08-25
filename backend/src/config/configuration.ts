export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',

  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'ca_sanjay_gst',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    logging: process.env.DB_LOGGING === 'true',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },

  aws: {
    region: process.env.AWS_REGION ?? 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    docsBucket: process.env.S3_DOCS_BUCKET ?? '',
    backupBucket: process.env.S3_BACKUP_BUCKET ?? '',
  },

  ses: {
    sourceEmail: process.env.SES_SOURCE_EMAIL ?? '',
    sourceName: process.env.SES_SOURCE_NAME ?? 'S N BAJAJ AND CO',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    appApiKey: process.env.FIREBASE_APP_API_KEY ?? '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
    vapidPublicKey: process.env.FIREBASE_VAPID_PUBLIC_KEY ?? '',
    vapidPrivateKey: process.env.FIREBASE_VAPID_PRIVATE_KEY ?? '',
    vapidSubject:
      process.env.FIREBASE_VAPID_SUBJECT ?? 'mailto:admin@example.com',
  },

  reminders: {
    leadDays: parseInt(process.env.REMINDER_LEAD_DAYS ?? '5', 10),
    cron: process.env.REMINDER_CRON ?? '0 8 * * *',
  },

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL ?? '',
    password: process.env.SUPER_ADMIN_PASSWORD ?? '',
    name: process.env.SUPER_ADMIN_NAME ?? 'Super Admin',
  },

  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  },

  androidApp: {
    minVersion: process.env.APP_ANDROID_MIN_VERSION ?? '1.0.0',
    latestVersion: process.env.APP_ANDROID_LATEST_VERSION ?? '1.0.0',
    storeUrl:
      process.env.PLAY_STORE_URL ??
      'https://play.google.com/store/apps/details?id=com.snbajaj.portal',
  },

  website: {
    deployHookUrl: process.env.CLOUDFLARE_DEPLOY_HOOK_URL ?? '',
    leadNotifyEmail:
      process.env.WEBSITE_LEAD_NOTIFY_EMAIL ?? 'casnbajaj2015@gmail.com',
  },
});
