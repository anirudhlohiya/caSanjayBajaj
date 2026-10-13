# WhatsApp AI Support Desk — Local Testing & Troubleshooting Guide

This guide explains how to test the WhatsApp AI Integration and Admin Chat Desk completely in your **local development environment** without needing to deploy or push code to production first.

---

## 1. Architecture & Zero-Cost Policy

The WhatsApp integration is designed to run at **₹0 operational cost**:

```
[Client WhatsApp] 
       │ (Free incoming webhook)
       ▼
[Meta Cloud API] 
       │ (Webhook payload via HTTPS)
       ▼
[Local Backend:3000 / NotificationsWebhookController]
       │
       ├─► 1. Lookup / Create conversation in PostgreSQL (`whatsapp_conversations`)
       ├─► 2. Auto-link to registered client via phone number (`users.phone`)
       ├─► 3. Emit real-time Server-Sent Event (SSE) to Admin UI
       │
       ▼
[Groq Cloud API] (Free Tier: 1,000 req/day, 8,000 tokens/min)
       │ Model: `openai/gpt-oss-120b` (Fallback: `openai/gpt-oss-20b`)
       │ Prompt: CA S N Bajaj & Co persona, GST/ITR rules, portal link
       ▼
[Local Backend] ──► Records outbound message in DB (`whatsapp_messages`)
       │
       ▼ (Free 1,000 service window replies/month)
[Meta Cloud API] ──► Delivers reply back to client on WhatsApp
```

---

## 2. Two Ways to Test Locally

### Method 1: Instant Script Simulation (No Phone / Tunnel Required)
*Recommended for fast day-to-day development, UI verification, and AI prompt testing.*

You do not need to send messages from a real WhatsApp device to test the backend logic or UI. You can simulate an inbound Meta webhook using Node.js.

#### Step 1: Run the simulation script
```bash
node scratch/simulate_local_message.js
```
Or create a custom script:
```javascript
const http = require('http');

const payload = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: {
          display_phone_number: '919316527283',
          phone_number_id: '1332098229994767'
        },
        contacts: [{
          profile: { name: 'Test Client' },
          wa_id: '919316527283'
        }],
        messages: [{
          from: '919316527283',
          id: 'wamid.test_' + Date.now(),
          timestamp: Math.floor(Date.now() / 1000).toString(),
          text: {
            body: 'What documents are required for GST registration?'
          },
          type: 'text'
        }]
      },
      field: 'messages'
    }]
  }]
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/v1/notifications/whatsapp-webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  console.log('Webhook Status:', res.statusCode);
});

req.write(payload);
req.end();
```

#### Step 2: Observe the results
1. **Console**: Check `backend` terminal for `Incoming WhatsApp message`, `Sending single AI reply`, and `AI reply successfully sent`.
2. **Admin UI**: Open `http://localhost:4200/admin/whatsapp-chats`. The new conversation and message thread will appear immediately with the AI reply and client auto-link badge.

---

### Method 2: Live WhatsApp via Free Tunnel (Phone to Laptop)
*Recommended when you want to test sending real WhatsApp messages from your smartphone to your official WhatsApp Business number and debug locally on your laptop.*

Meta's WhatsApp Cloud API delivers webhooks over the public internet. Since your local machine (`localhost:3000`) is behind your router/firewall without a public IP, you expose it using a free HTTPS tunnel.

#### Step 1: Start a free Cloudflare or ngrok tunnel
In a separate terminal, run:
```bash
# Option A: Cloudflare Tunnel (100% free, no account needed)
npx cloudflared tunnel --url http://localhost:3000

# Option B: ngrok (free account needed)
npx ngrok http 3000
```
This generates a temporary public HTTPS URL, for example:
`https://random-subdomain.trycloudflare.com`

#### Step 2: Configure Meta Webhook URL
1. Go to [developers.facebook.com](https://developers.facebook.com) → Your App → **WhatsApp** → **Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL**: `https://random-subdomain.trycloudflare.com/api/v1/notifications/whatsapp-webhook`
   - **Verify Token**: `snbajaj12snbajaj21` (matches `WHATSAPP_VERIFY_TOKEN` in `.env`)
3. Click **Verify and Save**.
4. Under **Webhook fields**, ensure `messages` is subscribed.

#### Step 3: Send a live WhatsApp message
1. Send a WhatsApp message from your personal phone to your WhatsApp Business number.
2. The message hits Meta → Meta sends the webhook to your Cloudflare tunnel → tunnel forwards it to your laptop (`http://localhost:3000`) → your local backend logs the event, queries Groq AI, and replies back to your phone.
3. Open `http://localhost:4200/admin/whatsapp-chats` to watch the conversation thread update live in real time.

---

## 3. Database Schema & Auto-Linking Logic

### Schema Requirements (`whatsapp_conversations`)
Ensure the local PostgreSQL database table has the `client_id` column:
```sql
ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_client_id ON whatsapp_conversations(client_id);
```

### Auto-Linking Behavior
Whenever an inbound message arrives:
1. The backend extracts the sender's phone number (e.g. `919316527283`).
2. It strips country codes/symbols and matches against `users.phone` (`RIGHT(phone, 10)`).
3. If a match is found:
   - `client_id` is set to the user ID.
   - `client_name` and `gstin` are auto-populated from the user profile.
   - `verified` is set to `true`.
4. In the Admin UI, the conversation card displays a **Verified Portal Client** badge and provides a 1-click shortcut: **"Open Client Profile & Docs"** (`/clients/:id`).

---

## 4. Groq AI Model Configuration & Resilient Fallback

### Model Selection (`backend/.env`)
```bash
GROQ_API_KEY = gsk_...
GROQ_MODEL=openai/gpt-oss-120b
```

### Resilient Fallback Loop in Code
To ensure zero downtime when Groq deprecates or maintains models, [`whatsapp-ai.service.ts`](file:///f:/Anirudh/sanjay%20project/backend/src/notifications/whatsapp-ai.service.ts) implements an automatic multi-model fallback chain:
```typescript
const candidateModels = [
  model,                  // 1. Configured primary model (openai/gpt-oss-120b)
  'openai/gpt-oss-120b',  // 2. High-intelligence flagship
  'openai/gpt-oss-20b',   // 3. High-speed compact fallback
  'qwen/qwen3.8-27b',     // 4. Multi-lingual fallback
];
```
If the primary model returns a `404` or rate-limit error, it automatically tries the next candidate within the same request.

---

## 5. Admin Panel UI (Vercel Geist Design & Dark Mode)

### Running Admin Locally
```bash
cd admin
npm start
```
Navigate to: `http://localhost:4200/admin/whatsapp-chats`

### Key UI Features
1. **Vercel Geist Typography & Palette**: High-contrast ink text, 1px hairline borders (`border-neutral-200/80 dark:border-neutral-800`), monospace metric counters.
2. **Mobile Responsiveness**:
   - On screens `< 768px`: Automatically switches between Conversation List and Active Thread using a sleek header back button.
   - On screens `< 1024px`: Client detail inspector opens as a slide-in drawer with a backdrop blur overlay.
3. **Dark Theme Support**:
   - Configured with Tailwind CSS v4 class-based dark variant `@custom-variant dark (&:where(.dark, .dark *));`.
   - Every surface, card, message bubble, and input includes explicit `dark:...` utility classes. Toggling `.dark` on the root container switches the entire UI to high-contrast dark mode.
4. **Staff Takeover Controls**:
   - Admin can click **Take Over** to pause automated AI responses and reply manually.
   - Admin can click **Return to AI** to resume bot assistance.
   - Typing and sending a staff message automatically engages takeover mode.

---

## 6. Troubleshooting Common Errors

| Error | Root Cause | Solution |
|---|---|---|
| `column c.client_id does not exist` | Local DB missing column from recent migration | Run `ALTER TABLE whatsapp_conversations ADD COLUMN IF NOT EXISTS client_id UUID;` |
| `Groq API error (404): model_not_found` | Model ID deprecated on Groq | Update `GROQ_MODEL=openai/gpt-oss-120b` in `.env` |
| `Unsupported post request. Object with ID does not exist` | Mismatched Meta Phone Number ID | Ensure `WHATSAPP_PHONE_NUMBER_ID` matches your Meta App phone ID (`1332098229994767`) |
| `24-hour customer service window expired` | Meta policy restricts free-form replies after 24h of inactivity | Send a new message from the client number to reset the 24-hour service window |
| `ECONNREFUSED 127.0.0.1:3000` | Backend dev server is stopped | Run `npm run start:dev` in `backend/` |
