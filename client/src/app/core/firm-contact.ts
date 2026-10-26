import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from './services/api-client.service';

/** Firm contact details managed in Admin → Services → Firm contact details. */
export interface FirmContact {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  map_url: string | null;
  /** "HH:MM", IST */
  open_from: string;
  open_to: string;
  /** 0 = Sunday … 6 = Saturday */
  open_days: number[];
}

export interface OfficeStatus {
  open: boolean;
  /** "Open now · closes 7:00 PM" / "Closed now · opens Mon 10:00 AM" */
  label: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const IST_OFFSET_MIN = 330;

/** Shared, cached copy of the firm's contact details. */
@Injectable({ providedIn: 'root' })
export class FirmContactService {
  private readonly api = inject(ApiClient);
  readonly contact = signal<FirmContact | null>(null);

  async load(): Promise<FirmContact> {
    const contact = await firstValueFrom(this.api.get<FirmContact>('/firm/contact'));
    this.contact.set(contact);
    return contact;
  }
}

/** Digits for wa.me / tel: links; bare 10-digit numbers are Indian (+91). */
export function phoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export function telHref(phone: string): string {
  return `tel:+${phoneDigits(phone)}`;
}

export function whatsappHref(phone: string, text?: string): string {
  const base = `https://wa.me/${phoneDigits(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/** "10:00" → "10:00 AM" */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Mon–Sat, 10:00 AM – 7:00 PM" */
export function hoursLabel(c: Pick<FirmContact, 'open_days' | 'open_from' | 'open_to'>): string {
  const days = [...c.open_days].sort();
  if (!days.length) return 'Closed';
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText =
    contiguous && days.length > 2
      ? `${WEEKDAYS[days[0]]}–${WEEKDAYS[days[days.length - 1]]}`
      : days.map((d) => WEEKDAYS[d]).join(', ');
  return `${dayText}, ${to12h(c.open_from)} – ${to12h(c.open_to)}`;
}

/**
 * Whether the office is open right now, in India time whatever the device's
 * time zone, and when it next opens or closes.
 */
export function officeStatus(
  c: Pick<FirmContact, 'open_days' | 'open_from' | 'open_to'>,
  now: Date = new Date(),
): OfficeStatus {
  const ist = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  const day = ist.getUTCDay();
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const from = toMin(c.open_from);
  const to = toMin(c.open_to);

  if (c.open_days.includes(day) && minutes >= from && minutes < to) {
    return { open: true, label: `Open now · closes ${to12h(c.open_to)}` };
  }
  // Next opening: later today, or the next working day
  for (let ahead = 0; ahead <= 7; ahead++) {
    const d = (day + ahead) % 7;
    if (!c.open_days.includes(d)) continue;
    if (ahead === 0 && minutes >= from) continue;
    const when = ahead === 0 ? 'today' : ahead === 1 ? 'tomorrow' : WEEKDAYS[d];
    return { open: false, label: `Closed now · opens ${when} ${to12h(c.open_from)}` };
  }
  return { open: false, label: 'Closed' };
}
