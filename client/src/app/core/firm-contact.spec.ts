import { hoursLabel, officeStatus, phoneDigits, whatsappHref } from './firm-contact';

const HOURS = { open_days: [1, 2, 3, 4, 5, 6], open_from: '10:00', open_to: '19:00' };
/** A moment given in India time (UTC+5:30). */
const ist = (iso: string) => new Date(`${iso}+05:30`);

describe('firm contact helpers', () => {
  it('is open on a working day inside office hours (India time)', () => {
    // Monday 26 Oct 2026, 11:30 IST
    expect(officeStatus(HOURS, ist('2026-10-26T11:30:00'))).toEqual({
      open: true,
      label: 'Open now · closes 7:00 PM',
    });
  });

  it('closes at 7 PM sharp and says when it reopens', () => {
    expect(officeStatus(HOURS, ist('2026-10-26T19:00:00'))).toEqual({
      open: false,
      label: 'Closed now · opens tomorrow 10:00 AM',
    });
    expect(officeStatus(HOURS, ist('2026-10-26T08:15:00')).label).toBe(
      'Closed now · opens today 10:00 AM',
    );
  });

  it('skips Sunday: Saturday evening reopens on Monday', () => {
    // Saturday 31 Oct 2026, 20:00 IST
    expect(officeStatus(HOURS, ist('2026-10-31T20:00:00')).label).toBe(
      'Closed now · opens Mon 10:00 AM',
    );
  });

  it('formats the hours line', () => {
    expect(hoursLabel(HOURS)).toBe('Mon–Sat, 10:00 AM – 7:00 PM');
  });

  it('builds wa.me links with the Indian country code', () => {
    expect(phoneDigits('+91 78783 98067')).toBe('917878398067');
    expect(phoneDigits('99098 31995')).toBe('919909831995');
    expect(whatsappHref('99098 31995', 'Hi')).toBe('https://wa.me/919909831995?text=Hi');
  });
});
