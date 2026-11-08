import { TestBed } from '@angular/core/testing';
import { GOV_SOURCES, GovSources } from './gov-sources';

describe('GovSources (Play Misleading Claims policy)', () => {
  it('links only to official .gov.in sites, opening outside the app', () => {
    expect(GOV_SOURCES.every((s) => /^https:\/\/([a-z-]+\.)*gov\.in$/.test(s.href))).toBeTrue();
    const fixture = TestBed.createComponent(GovSources);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'));
    expect(links.length).toBe(GOV_SOURCES.length);
    expect(links.every((a) => a.target === '_blank' && a.rel.includes('noopener'))).toBeTrue();
  });

  it('says plainly that the app is not a government app', () => {
    const fixture = TestBed.createComponent(GovSources);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('This app is not a government app');
  });
});
