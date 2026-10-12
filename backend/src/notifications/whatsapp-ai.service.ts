import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ConversationSession {
  messages: ChatMessage[];
  lastActive: number;
}

@Injectable()
export class WhatsappAiService {
  private readonly logger = new Logger(WhatsappAiService.name);
  private readonly conversations = new Map<string, ConversationSession>();
  private readonly processedMessageIds = new Map<string, number>();

  private readonly SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
  private readonly DEDUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_HISTORY_MESSAGES = 6;

  constructor(private readonly config: ConfigService) {}

  private getSystemPrompt(): string {
    return `You are the friendly, intelligent, and professional WhatsApp AI Assistant for **S N Bajaj And Co**, a premier Chartered Accountant (CA) firm founded by CA Sanjay Bajaj.

### Firm Profile & Details:
- **Firm Name**: S N Bajaj And Co (Chartered Accountants)
- **Principal CA / Founder**: CA Sanjay Bajaj
- **Office Address**: 2007, Trade House, Opp. Man Darwaja Fire Station, Ring Road, Surat, Gujarat 395002, India
- **Office Timings**: Monday to Saturday, 10:00 AM – 7:00 PM (Closed on Sundays)
- **Official Email**: casnbajaj2015@gmail.com
- **Office Telephone**: +91 99098 31995
- **Website**: https://snbajaj.com
- **Client Web Portal**: https://app.snbajaj.com
- **Android App**: "SN Bajaj And Co - GST Client Portal" (available on Google Play Store)

### Core Practice Areas & Services:
1. **GST (Goods & Services Tax)**:
   - GST Registration, Amendment, and Cancellation / Revocation
   - Monthly & Quarterly Return Filing: GSTR-1, GSTR-3B, CMP-08
   - Annual Return: GSTR-9 and GSTR-9C reconciliation
   - Nil Return filing (direct declaration supported on client portal)
   - Handling GST notices, audits, departmental summons, and refund claims

2. **Income Tax & Direct Taxation**:
   - ITR Filing for Individuals (Salaried, Freelancers, Capital Gains), Firms, LLPs, and Companies (ITR-1 through ITR-7)
   - Advance Tax estimation and Tax Planning
   - TDS Returns (Form 24Q, 26Q) and TCS filing
   - Notice resolution, scrutiny assessments, and rectification

3. **Corporate & Business Registrations**:
   - Company Incorporation (Private Limited, OPC, Public Ltd)
   - LLP (Limited Liability Partnership) & Partnership Deed drafting
   - MSME / Udyam Registration, Startup India DPIIT recognition
   - Import Export Code (IEC), Trademark registration
   - Digital Signature Certificates (DSC - Class 3)

4. **Accounting, Bookkeeping & Auditing**:
   - Complete outsourced accounting & bookkeeping
   - Statutory Audit, Tax Audit (Sec 44AB), Internal Audit
   - CMA Data preparation, Project Reports for Bank Loans & Working Capital

5. **Client Portal & Document Submissions**:
   - Clients can securely upload bills, bank statements, and purchase/sales sheets on the client portal at https://app.snbajaj.com or through our Android app.
   - Once filed, GST / ITR acknowledgment reports are delivered straight to their portal account and WhatsApp.

### Tone & WhatsApp Formatting Guidelines:
- Keep responses concise, warm, helpful, and formatted for easy mobile reading.
- Use clean WhatsApp markdown: *bold* for emphasis, bullet points (•) for lists.
- Avoid overwhelming walls of text. Be direct and structure information in short, clear paragraphs.
- When greeting (e.g. "Hi", "Hello", "Namaste"), warmly introduce yourself as the assistant for S N Bajaj And Co and ask how you can help with their taxation, GST, ITR, or business accounting needs.
- If a client wants to file a return or get work done, mention the primary documents needed (e.g., invoices, bank statement, PAN, Aadhaar) and guide them to upload on https://app.snbajaj.com or contact our office team at +91 99098 31995 / casnbajaj2015@gmail.com.
- Do not make up non-existent legal or tax deadlines. If uncertain, suggest speaking directly with CA Sanjay Bajaj or the office team.`;
  }

  /**
   * Generates an AI response for an incoming WhatsApp text message.
   * Returns null if the message is a duplicate or Groq is unconfigured.
   */
  async generateReply(
    from: string,
    messageId: string,
    userText: string,
  ): Promise<string | null> {
    this.cleanExpiredCache();

    // 1. Deduplicate webhook delivery retries
    if (messageId) {
      if (this.processedMessageIds.has(messageId)) {
        this.logger.debug(
          `Ignoring duplicate WhatsApp message ID: ${messageId}`,
        );
        return null;
      }
      this.processedMessageIds.set(messageId, Date.now());
    }

    const trimmedInput = userText?.trim();
    if (!trimmedInput) {
      return null;
    }

    const apiKey = this.config.get<string>('groq.apiKey');
    const model =
      this.config.get<string>('groq.model') || 'llama-3.3-70b-versatile';

    if (!apiKey) {
      this.logger.warn(
        'GROQ_API_KEY is not configured in environment variables',
      );
      return (
        'Hello! Thank you for reaching out to *S N Bajaj And Co* (Chartered Accountants).\n\n' +
        'Our automated assistant is currently being configured. Please contact our office directly at *+91 99098 31995* or email *casnbajaj2015@gmail.com* for assistance.\n\n' +
        'You can also visit our client portal at https://app.snbajaj.com.'
      );
    }

    // 2. Fetch or initialize conversation history
    const session = this.getOrCreateSession(from);

    // Append new user message to session
    session.messages.push({ role: 'user', content: trimmedInput });
    session.lastActive = Date.now();

    // Limit history length
    if (session.messages.length > this.MAX_HISTORY_MESSAGES) {
      session.messages = session.messages.slice(-this.MAX_HISTORY_MESSAGES);
    }

    // 3. Prepare messages payload for Groq
    const payloadMessages: ChatMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      ...session.messages,
    ];

    try {
      const response = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: payloadMessages,
            temperature: 0.6,
            max_tokens: 650,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Groq API error (${response.status}): ${errorText}`);
        return (
          'Thank you for messaging *S N Bajaj And Co*.\n\n' +
          'We received your message and our team will get back to you shortly. You can also reach our office at *+91 99098 31995* or visit https://app.snbajaj.com.'
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const replyContent = data.choices?.[0]?.message?.content?.trim();
      if (!replyContent) {
        return null;
      }

      // Record assistant reply in history
      session.messages.push({ role: 'assistant', content: replyContent });
      return replyContent;
    } catch (error) {
      this.logger.error(
        `Failed to generate AI reply via Groq: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private getOrCreateSession(from: string): ConversationSession {
    const existing = this.conversations.get(from);
    const now = Date.now();

    if (existing && now - existing.lastActive < this.SESSION_TIMEOUT_MS) {
      existing.lastActive = now;
      return existing;
    }

    const freshSession: ConversationSession = {
      messages: [],
      lastActive: now,
    };
    this.conversations.set(from, freshSession);
    return freshSession;
  }

  private cleanExpiredCache(): void {
    const now = Date.now();

    for (const [key, timestamp] of this.processedMessageIds.entries()) {
      if (now - timestamp > this.DEDUP_TIMEOUT_MS) {
        this.processedMessageIds.delete(key);
      }
    }

    for (const [phone, session] of this.conversations.entries()) {
      if (now - session.lastActive > this.SESSION_TIMEOUT_MS) {
        this.conversations.delete(phone);
      }
    }
  }
}
