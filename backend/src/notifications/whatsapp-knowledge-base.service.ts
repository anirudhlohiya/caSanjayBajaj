import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface KnowledgeSection {
  title: string;
  description: string;
  content: string;
  client_interview_placeholder?: string;
}

export interface KnowledgeBaseData {
  version: string;
  last_updated: string;
  sections: Record<string, KnowledgeSection>;
}

@Injectable()
export class WhatsappKnowledgeBaseService {
  private readonly logger = new Logger(WhatsappKnowledgeBaseService.name);
  private readonly filePath = path.resolve(
    process.cwd(),
    'data',
    'whatsapp-knowledge-base.json',
  );

  private cachedData: KnowledgeBaseData | null = null;
  private cachedMtime: number = 0;
  private cachedPromptSnippet: string = '';

  constructor() {
    this.loadKnowledgeBase();
  }

  /**
   * Loads knowledge base from data/whatsapp-knowledge-base.json.
   * Checks mtime to hot-reload without code changes or server restarts.
   */
  public loadKnowledgeBase(): KnowledgeBaseData | null {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.logger.warn(
          `Knowledge base file not found at ${this.filePath}. Using fallback.`,
        );
        return null;
      }

      const stat = fs.statSync(this.filePath);
      if (this.cachedData && stat.mtimeMs === this.cachedMtime) {
        return this.cachedData;
      }

      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as KnowledgeBaseData;
      this.cachedData = parsed;
      this.cachedMtime = stat.mtimeMs;
      this.cachedPromptSnippet = this.buildPromptSnippet(parsed);
      this.logger.log(
        `Loaded WhatsApp Knowledge Base (v${parsed.version}, updated ${parsed.last_updated}) from disk`,
      );
      return this.cachedData;
    } catch (err) {
      this.logger.error(
        `Failed to load knowledge base file: ${(err as Error).message}`,
      );
      return this.cachedData;
    }
  }

  /**
   * Returns formatted prompt context representing all 11 knowledge sections.
   */
  public getKnowledgeBasePromptContext(): string {
    this.loadKnowledgeBase();
    if (this.cachedPromptSnippet) {
      return this.cachedPromptSnippet;
    }
    return 'Knowledge Base is currently being initialized by the office.';
  }

  /**
   * Returns the raw knowledge base object (for admin inspection or API editing).
   */
  public getRawData(): KnowledgeBaseData | null {
    return this.loadKnowledgeBase();
  }

  /**
   * Allows saving an updated knowledge base directly to disk.
   */
  public saveKnowledgeBase(data: KnowledgeBaseData): boolean {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      data.last_updated = new Date().toISOString().slice(0, 10);
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.loadKnowledgeBase();
      this.logger.log('Successfully updated WhatsApp knowledge base on disk');
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to write knowledge base file: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private buildPromptSnippet(kb: KnowledgeBaseData): string {
    const lines: string[] = [];
    lines.push('### PRACTICE KNOWLEDGE BASE (OFFICIAL SOURCE OF TRUTH):');
    lines.push(
      'Answer general inquiries ONLY from the facts below. If an inquiry is not answered by these facts, do NOT invent details; respond that you will check with our team and get back to them.',
    );
    lines.push('');

    const sections = kb.sections || {};
    for (const [key, section] of Object.entries(sections)) {
      lines.push(`#### [${section.title.toUpperCase()}]`);
      if (section.content) {
        lines.push(section.content.trim());
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
