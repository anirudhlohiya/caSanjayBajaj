export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000',
  // Public origin of the client PWA, used for links in emails/WhatsApp
  clientAppUrl: process.env.CLIENT_APP_URL ?? 'https://app.snbajaj.com',

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
    snsTopicArn: process.env.SNS_TOPIC_ARN ?? '',
  },

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    appApiKey: process.env.FIREBASE_APP_API_KEY ?? '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? '',
    vapidPublicKey: process.env.FIREBASE_VAPID_PUBLIC_KEY ?? '',
    vapidPrivateKey: process.env.FIREBASE_VAPID_PRIVATE_KEY ?? '',
    vapidSubject:
      process.env.FIREBASE_VAPID_SUBJECT ?? 'mailto:admin@example.com',
    /**
     * Path to the Firebase service-account JSON used to send Android app
     * notifications (FCM). Empty = Android push is off; web push still works.
     */
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? '',
  },

  reminders: {
    leadDays: parseInt(process.env.REMINDER_LEAD_DAYS ?? '5', 10),
    cron: process.env.REMINDER_CRON ?? '0 8 * * *',
    // Cron that drives the *task-slack* auto reminders (docs/13 §5.2).
    // TASK_REMINDER_CRON overrides REMINDER_CRON; both default to 08:00.
    taskCron:
      process.env.TASK_REMINDER_CRON ??
      process.env.REMINDER_CRON ??
      '0 8 * * *',
  },

  shareLinks: {
    // Lifetime of the emailed 30-day report download tokens (docs/13 §3.8).
    ttlDays: parseInt(process.env.SHARE_LINK_TTL_DAYS ?? '30', 10),
  },

  autoCreatePeriods: {
    // How many future months beyond the current one to auto-ensure on the
    // monthly rollover cron (docs/13 §10).
    prefetch: parseInt(process.env.AUTO_CREATE_PERIODS_PREFETCH ?? '2', 10),
  },

  nilFiling: {
    // Where client nil-declaration alerts go (docs/13 §10.3). Defaults to the
    // firm's CA account address.
    adminNotifyEmail:
      process.env.NIL_PENDING_ADMIN_NOTIFY_EMAIL ?? 'casnbajaj2015@gmail.com',
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

  libreOffice: {
    enabled: process.env.LIBREOFFICE_ENABLED === 'true',
    binary: process.env.LIBREOFFICE_BINARY ?? 'soffice',
    timeoutMs: process.env.LIBREOFFICE_TIMEOUT_MS ?? '60000',
  },

  onlyOffice: {
    enabled: process.env.ONLYOFFICE_ENABLED === 'true',
    serverUrl: process.env.ONLYOFFICE_SERVER_URL ?? '',
    jwtSecret: process.env.ONLYOFFICE_JWT_SECRET ?? '',
    apiBaseUrl:
      process.env.ONLYOFFICE_API_BASE_URL ||
      process.env.API_BASE_URL ||
      'http://localhost:3000',
  },

  whatsapp: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    businessId: process.env.WHATSAPP_BUSINESS_ID ?? '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    number: process.env.WHATSAPP_NUMBER ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
    /** Meta App Secret: verifies X-Hub-Signature-256 on incoming webhooks. */
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
    // Meta-approved Utility template names (see notifications/whatsapp-templates.ts)
    templates: {
      returnFiled: process.env.WHATSAPP_TPL_RETURN_FILED ?? 'gst_return_filed',
      paymentReminder:
        process.env.WHATSAPP_TPL_PAYMENT_REMINDER ?? 'gst_payment_reminder',
      documentsReminder:
        process.env.WHATSAPP_TPL_DOCUMENTS_REMINDER ?? 'gst_documents_reminder',
      generalFollowup:
        process.env.WHATSAPP_TPL_GENERAL_FOLLOWUP ??
        'gst_filing_input_required',
    },
    templateLanguage: process.env.WHATSAPP_TPL_LANGUAGE ?? 'en',
    // Account that owns the message templates (the Messaging Account under
    // WAME, which can differ from WHATSAPP_BUSINESS_ID). Falls back to it.
    templatesAccountId:
      process.env.WHATSAPP_TEMPLATES_ACCOUNT_ID ||
      process.env.WHATSAPP_BUSINESS_ID ||
      '',
    // Seconds to wait after the last file before asking the client what the files are
    uploadBatchSeconds: parseInt(
      process.env.WHATSAPP_UPLOAD_BATCH_SECONDS ?? '20',
      10,
    ),
  },

  groq: {
    apiKey: process.env.GROQ_API_KEY ?? '',
    model: process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant',
    // Speech-to-text for WhatsApp voice notes (Groq free tier)
    transcriptionModel:
      process.env.GROQ_TRANSCRIPTION_MODEL ?? 'whisper-large-v3-turbo',
  },

  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucketName: process.env.R2_BUCKET_NAME ?? 'snbajaj-whatsapp-media',
    publicUrl: process.env.R2_PUBLIC_URL ?? '',
  },
});
