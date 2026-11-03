import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FirmContact, FirmContactService } from '../../core/firm-contact';
import { TicketsService } from '../../core/services/feature.services';
import { Contact } from '../contact/contact';
import { TalkToExpert } from '../talk-to-expert/talk-to-expert';
import { NewTicket } from './new-ticket';
import { Support } from './support';
import { TicketDetail } from './ticket-detail';

const page = (items: object[]) => ({ items, total: items.length, page: 1, pageSize: 20, totalPages: 1 });
const office = (open: boolean): FirmContact => ({
  phone: '9316527283', whatsapp: '9316527283', email: 'casnbajaj2015@gmail.com',
  address: '2007, Trade House, Ring Road, Surat', map_url: 'https://maps.example/sn',
  open_from: '00:00', open_to: '23:59', open_days: open ? [0, 1, 2, 3, 4, 5, 6] : [],
});

describe('Help screens', () => {
  let tickets: jasmine.SpyObj<TicketsService>;
  const contact = signal<FirmContact | null>(null);

  beforeEach(async () => {
    tickets = jasmine.createSpyObj<TicketsService>('TicketsService', ['list', 'create', 'get', 'reply', 'close']);
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TicketsService, useValue: tickets },
        { provide: FirmContactService, useValue: { contact, load: async () => contact() } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 't1' })), snapshot: { paramMap: convertToParamMap({ id: 't1' }) } } },
      ],
    }).compileComponents();
  });

  describe('Support list', () => {
    it('filters by status and marks the active filter', async () => {
      tickets.list.and.resolveTo(page([{ id: 't1', subject: 'Need GSTR-1', category: 'documents', status: 'open', created_at: '2026-11-02T05:00:00Z' }]) as never);
      const fixture = TestBed.createComponent(Support);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('Need GSTR-1');
      expect(el.querySelector('.bg-gold-tint')?.textContent?.trim()).toBe('open');

      (Array.from(el.querySelectorAll('[aria-pressed]')).find((b) => b.textContent?.trim() === 'Closed') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(tickets.list).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'closed' }));
      expect(el.querySelector('[aria-pressed=true]')?.textContent?.trim()).toBe('Closed');
    });

    it('shows a real empty state (title and message)', async () => {
      tickets.list.and.resolveTo(page([]) as never);
      const fixture = TestBed.createComponent(Support);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      const text = fixture.nativeElement.textContent;
      expect(text).toContain('No support tickets yet');
      expect(text).toContain("Need help? Create a support ticket and we'll get back to you.");
      expect(text).not.toContain('Nothing here yet');
    });
  });

  describe('New ticket', () => {
    it('priority is a one-tap choice and is sent with the ticket', async () => {
      tickets.create.and.resolveTo({ id: 'new1', messages: [] } as never);
      spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      const fixture = TestBed.createComponent(NewTicket);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const radios = Array.from(el.querySelectorAll('[role=radio]')) as HTMLButtonElement[];
      expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
      radios[2].click();
      fixture.detectChanges();
      expect(radios[2].getAttribute('aria-checked')).toBe('true');

      fixture.componentInstance.form.patchValue({ subject: 'Need GSTR-1 for March 2026', message: 'Please share the filed copy.' });
      await fixture.componentInstance.submit();
      expect(tickets.create).toHaveBeenCalledWith(jasmine.objectContaining({ priority: 'high', subject: 'Need GSTR-1 for March 2026' }));
    });
  });

  describe('Ticket detail', () => {
    it('a closed ticket offers a new request instead of a reply box', async () => {
      tickets.get.and.resolveTo({
        id: 't1', subject: 'Need GSTR-1 for March 2026', category: 'general', status: 'closed',
        created_at: '2026-10-24T05:00:00Z', messages: [{ id: 'm1', sender_type: 'admin', message: 'Done', created_at: '2026-10-24T06:00:00Z' }],
      } as never);
      const fixture = TestBed.createComponent(TicketDetail);
      fixture.detectChanges(); // ngOnInit loads ticket t1 from the route
      await fixture.whenStable();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.textContent).toContain('This request is closed');
      expect(el.querySelector('textarea')).toBeNull();
      expect(el.querySelector('.bg-surface-container.text-on-surface-variant')?.textContent?.trim()).toBe('Closed');
    });
  });

  describe('Talk to expert and Contact', () => {
    it('outside office hours: no call link, WhatsApp still there', async () => {
      contact.set(office(false));
      const fixture = TestBed.createComponent(TalkToExpert);
      await fixture.componentInstance.load();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('a[href^="tel:"]')).toBeNull();
      expect(el.querySelector('a[href^="https://wa.me/919316527283"]')).not.toBeNull();
      expect(el.querySelector('[aria-disabled=true]')?.textContent).toContain('Calls open during office hours');
      fixture.destroy();
    });

    it('in office hours: Contact offers call, WhatsApp, email and the map', async () => {
      contact.set(office(true));
      const fixture = TestBed.createComponent(Contact);
      await fixture.componentInstance.load();
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('a[href="tel:+919316527283"]')).not.toBeNull();
      expect(el.querySelector('a[href^="mailto:casnbajaj2015@gmail.com"]')).not.toBeNull();
      expect(el.querySelector('a[href="https://maps.example/sn"]')?.textContent).toContain('Open in Google Maps');
      fixture.destroy();
    });
  });
});
