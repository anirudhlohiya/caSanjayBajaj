import { resolveNav } from './nav-map';

describe('resolveNav', () => {
  it('shows the greeting on the start destination, with no back button', () => {
    const entry = resolveNav('/dashboard');
    expect(entry.titleKey).toBe('HEADER.GREETING');
    expect(entry.subtitleKey).toBe('HEADER.SUBGREETING');
    expect(entry.backTo).toBeNull();
  });

  it('gives every bottom-nav tab a title and no back button', () => {
    for (const path of ['/services', '/documents', '/reminders', '/profile']) {
      const entry = resolveNav(path);
      expect(entry.titleKey).withContext(path).toBeTruthy();
      expect(entry.backTo).withContext(path).toBeNull();
    }
  });

  it('points sub-destinations at their logical parent', () => {
    expect(resolveNav('/reports').backTo).toBe('/dashboard');
    expect(resolveNav('/support').backTo).toBe('/profile');
    expect(resolveNav('/support/new').backTo).toBe('/support');
    expect(resolveNav('/documents/upload').backTo).toBe('/documents');
    expect(resolveNav('/notifications').backTo).toBe('/dashboard');
  });

  it('treats any /support/<id> as a ticket detail page', () => {
    for (const path of ['/support/42', '/support/abc-123', '/support/7/']) {
      const entry = resolveNav(path);
      expect(entry.backTo).withContext(path).toBe('/support');
      // The subject is dynamic, so the page owns its heading.
      expect(entry.titleKey).withContext(path).toBeNull();
    }
  });

  it('keeps /support/new out of the ticket-detail catch-all', () => {
    expect(resolveNav('/support/new').titleKey).toBe('HEADER.SUPPORT_NEW');
  });

  it('ignores query params and trailing slashes', () => {
    expect(resolveNav('/documents?periodId=3').titleKey).toBe('HEADER.DOCUMENTS');
    expect(resolveNav('/documents/').titleKey).toBe('HEADER.DOCUMENTS');
    expect(resolveNav('/support/42#msg-3').backTo).toBe('/support');
  });

  it('falls back to no header for unknown and auth routes', () => {
    for (const path of ['/login', '/signup', '/not-found', '/whatever', '/']) {
      const entry = resolveNav(path);
      expect(entry.titleKey).withContext(path).toBeNull();
      expect(entry.backTo).withContext(path).toBeNull();
    }
  });
});
