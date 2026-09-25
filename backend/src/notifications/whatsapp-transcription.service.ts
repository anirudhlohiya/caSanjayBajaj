import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Speech-to-text for WhatsApp voice notes via Groq's Whisper endpoint (free
 * tier, same GROQ_API_KEY as the chat brain). Handles English, Hindi and
 * Hinglish. Returns null when not configured or on any failure so the caller
 * can ask the client to type instead.
 */
@Injectable()
export class WhatsappTranscriptionService {
  private readonly logger = new Logger(WhatsappTranscriptionService.name);

  constructor(private readonly config: ConfigService) {}

  async transcribe(
    audio: Buffer,
    mimeType: string = 'audio/ogg',
  ): Promise<string | null> {
    const apiKey =
      this.config.get<string>('groq.apiKey') ||
      this.config.get<string>('GROQ_API_KEY');
    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is not configured; cannot transcribe');
      return null;
    }
    const model =
      this.config.get<string>('groq.transcriptionModel') ||
      'whisper-large-v3-turbo';

    try {
      const form = new FormData();
      const ext = mimeType.includes('mpeg')
        ? 'mp3'
        : mimeType.includes('mp4')
          ? 'm4a'
          : 'ogg';
      form.append(
        'file',
        new Blob([new Uint8Array(audio)], {
          type: mimeType.split(';')[0],
        }),
        `voice.${ext}`,
      );
      form.append('model', model);
      form.append('response_format', 'json');
      form.append('temperature', '0');

      const response = await fetch(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        },
      );
      if (!response.ok) {
        this.logger.warn(
          `Groq transcription failed: HTTP ${response.status} ${await response.text()}`,
        );
        return null;
      }
      const data = (await response.json()) as { text?: string };
      const text = data.text?.trim();
      return text ? text : null;
    } catch (err) {
      this.logger.warn(`Groq transcription error: ${(err as Error).message}`);
      return null;
    }
  }
}
