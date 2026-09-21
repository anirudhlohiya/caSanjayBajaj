import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PDF_CACHE_TTL_MS = 30 * 60 * 1000;
const PDF_CACHE_MAX = 25;

/**
 * Renders DOCX files to faithful PDFs with headless LibreOffice.
 *
 * Conversions are serialized (one soffice process at a time) with an isolated
 * user profile, which keeps the API safe on low-memory instances and avoids
 * soffice profile-lock crashes. PDFs are cached in memory keyed by the SHA-256
 * of the source document, so identical requests never re-render.
 */
@Injectable()
export class LibreOfficeService {
  private readonly logger = new Logger(LibreOfficeService.name);
  private readonly cache = new Map<
    string,
    { buffer: Buffer; expiresAt: number }
  >();
  private queueTail: Promise<unknown> = Promise.resolve();

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return this.config.get<boolean>('libreOffice.enabled') === true;
  }

  private get binary(): string {
    const binary = this.config.get<string>('libreOffice.binary') ?? '';
    return binary.trim() || 'soffice';
  }

  private get timeoutMs(): number {
    return parseInt(
      this.config.get<string>('libreOffice.timeoutMs') ?? '60000',
      10,
    );
  }

  async convertDocxToPdf(docx: Buffer): Promise<Buffer> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        'PDF preview requires LibreOffice to be enabled on the server',
      );
    }
    const hash = createHash('sha256').update(docx).digest('hex');
    const hit = this.cache.get(hash);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.buffer;
    }

    const pdf = await this.enqueue(() => this.doConvert(hash, docx));

    this.cache.set(hash, {
      buffer: pdf,
      expiresAt: Date.now() + PDF_CACHE_TTL_MS,
    });
    if (this.cache.size > PDF_CACHE_MAX) {
      const next = this.cache.keys().next();
      if (!next.done) this.cache.delete(next.value);
    }
    return pdf;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queueTail.then(task, task);
    this.queueTail = result.catch(() => undefined);
    return result;
  }

  private doConvert(hash: string, docx: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'loffice-'));
      const input = path.join(workdir, `${hash}.docx`);
      const output = path.join(workdir, `${hash}.pdf`);
      let settled = false;

      const fail = (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          fs.rmSync(workdir, { recursive: true, force: true });
          reject(err);
        }
      };

      try {
        fs.writeFileSync(input, docx);
      } catch (err) {
        fs.rmSync(workdir, { recursive: true, force: true });
        reject(err as Error);
        return;
      }

      const profileUrl = pathToFileURL(path.join(workdir, 'profile')).href;
      const child = spawn(
        this.binary,
        [
          '--headless',
          '--norestore',
          '--nolockcheck',
          `-env:UserInstallation=${profileUrl}`,
          '--convert-to',
          'pdf',
          '--outdir',
          workdir,
          input,
        ],
        { env: { ...process.env, HOME: workdir, USERPROFILE: workdir } },
      );

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        fail(
          new Error(`LibreOffice conversion timed out (${this.timeoutMs}ms)`),
        );
      }, this.timeoutMs);

      child.on('error', (err) => {
        const nodeError = err as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          fail(new Error(`LibreOffice binary not found: ${this.binary}`));
        } else {
          fail(err);
        }
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (settled) return;
        try {
          if (code !== 0) {
            fail(
              new Error(
                `LibreOffice exited with code ${code}: ${stderr.trim()}`,
              ),
            );
            return;
          }
          if (!fs.existsSync(output)) {
            fail(new Error('LibreOffice finished but produced no PDF output'));
            return;
          }
          settled = true;
          resolve(fs.readFileSync(output));
        } finally {
          fs.rmSync(workdir, { recursive: true, force: true });
        }
      });
    });
  }
}
