import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ServicesOfferedService } from '../../core/services/feature.services';
import { ServiceDetailPage } from './service-detail';
import { Services } from './services';

const gst = {
  id: '1', slug: 'gst', title: 'GST Services', icon: 'receipt_long', icon_color: 'blue',
  description: 'Comprehensive GST solutions.', tags: ['Registration', 'Return Filing', 'Refund'],
  body_md: '## Fees\nAsk us.', price: null, contact: { phone: '919316527283', whatsapp: '919316527283' },
};
const itr = { ...gst, id: '2', slug: 'income-tax', title: 'Income Tax', tags: ['ITR Filing'], description: 'Expert ITR filing.' };

describe('Services list', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Services],
      providers: [provideRouter([]), { provide: ServicesOfferedService, useValue: { listActive: async () => [gst, itr] } }],
    }).compileComponents();
  });

  it('shows every service in the brand style and filters by the search box', async () => {
    const fixture = TestBed.createComponent(Services);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('a.card').length).toBe(2);
    // admin colour choices no longer change the icon tile
    expect(el.querySelectorAll('.bg-brand-tint').length).toBe(2);

    fixture.componentInstance.searchQuery.set('itr');
    fixture.detectChanges();
    expect(Array.from(el.querySelectorAll('a.card h3')).map((h) => h.textContent?.trim())).toEqual(['Income Tax']);
  });
});

describe('Service detail', () => {
  let enquire: jasmine.Spy;

  beforeEach(async () => {
    enquire = jasmine.createSpy('enquire').and.resolveTo({ id: 'ticket-9' });
    await TestBed.configureTestingModule({
      imports: [ServiceDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ slug: 'gst' })) } },
        { provide: ServicesOfferedService, useValue: { get: async () => gst, enquire } },
      ],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(ServiceDetailPage);
    await fixture.componentInstance.load('gst');
    fixture.detectChanges();
    return fixture;
  }

  it("lists what's included, the next steps, and keeps the admin page content", async () => {
    const el: HTMLElement = (await render()).nativeElement;
    expect(Array.from(el.querySelectorAll('ul li')).map((li) => li.textContent?.replace('check_circle', '').trim())).toEqual([
      'Registration', 'Return Filing', 'Refund',
    ]);
    expect(el.querySelectorAll('ol li').length).toBe(3);
    expect(el.textContent).toContain('Usually within 1 working day, by phone.');
    expect(el.querySelector('.md-content h2')?.textContent).toBe('Fees');
    expect(el.querySelector('a[aria-label="WhatsApp us"]')?.getAttribute('href')).toContain('https://wa.me/919316527283');
    expect(el.querySelector('a[aria-label="Call us"]')?.getAttribute('href')).toBe('tel:+919316527283');
  });

  it('sends a request from the sheet and opens it in Support', async () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = await render();
    const el: HTMLElement = fixture.nativeElement;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Request this service')) as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[role=dialog]')?.textContent).toContain('Request GST Services');

    fixture.componentInstance.requestMessage.set('  New shop in Surat  ');
    await fixture.componentInstance.submitRequest();
    fixture.detectChanges();
    expect(enquire).toHaveBeenCalledWith('gst', 'New shop in Surat');
    expect(el.querySelector('[role=dialog]')?.textContent).toContain('Request sent');

    await fixture.componentInstance.viewRequest();
    expect(navigate).toHaveBeenCalledWith(['/support', 'ticket-9']);
  });
});
