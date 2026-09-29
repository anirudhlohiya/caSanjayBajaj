/**
 * Single source of truth for the app's top bar: which title/subtitle each route
 * shows, and whether it gets a back button.
 *
 * Back-button rule, taken from Android's "Principles of navigation":
 * the Up button never exits the app. It appears only on sub-destinations —
 * screens reached from within the app. Top-level tab destinations never show it,
 * because the bottom nav is their way out.
 *
 * Because this is a static map rather than a runtime history check, the back
 * button can never disagree with where back actually goes, and it can never
 * drop the user out of the app on a deep link.
 */

export interface NavEntry {
  /** i18n key for the header title. `null` renders no title text. */
  readonly titleKey: string | null;
  /** i18n key for the optional second line. */
  readonly subtitleKey: string | null;
  /**
   * Logical parent route. When set, the back button is shown and navigates here.
   * `null` marks a top-level destination, which gets no back button.
   */
  readonly backTo: string | null;
}

const NO_HEADER: NavEntry = {
  titleKey: null,
  subtitleKey: null,
  backTo: null,
};

const NAV_ENTRIES: Readonly<Record<string, NavEntry>> = {
  // --- Top-level destinations (the five bottom-nav tabs) --------------------
  '/dashboard': {
    titleKey: 'HEADER.GREETING',
    subtitleKey: 'HEADER.SUBGREETING',
    backTo: null,
  },
  '/services': { titleKey: 'HEADER.SERVICES', subtitleKey: null, backTo: null },
  '/documents': {
    titleKey: 'HEADER.DOCUMENTS',
    subtitleKey: 'HEADER.DOCUMENTS_SUB',
    backTo: null,
  },
  '/reminders': {
    titleKey: 'HEADER.REMINDERS',
    subtitleKey: 'HEADER.REMINDERS_SUB',
    backTo: null,
  },
  '/profile': { titleKey: 'HEADER.PROFILE', subtitleKey: null, backTo: null },

  // --- Sub-destinations -----------------------------------------------------
  '/reports': {
    titleKey: 'HEADER.REPORTS',
    subtitleKey: 'HEADER.REPORTS_SUB',
    backTo: '/dashboard',
  },
  '/support': { titleKey: 'HEADER.SUPPORT', subtitleKey: null, backTo: '/profile' },
  '/support/new': {
    titleKey: 'HEADER.SUPPORT_NEW',
    subtitleKey: 'HEADER.SUPPORT_NEW_SUB',
    backTo: '/support',
  },
  // The ticket subject is dynamic, so the page renders its own heading and the
  // shell only supplies the back button.
  '/support/:id': { titleKey: null, subtitleKey: null, backTo: '/support' },

  // --- Standalone routes that render outside the shell ----------------------
  '/documents/upload': {
    titleKey: 'HEADER.UPLOAD',
    subtitleKey: 'HEADER.UPLOAD_SUB',
    backTo: '/documents',
  },
  '/notifications': {
    titleKey: 'HEADER.NOTIFICATIONS',
    subtitleKey: null,
    backTo: '/dashboard',
  },
};

/** Strips query params/fragments and normalises trailing slashes. */
function toPath(url: string): string {
  const path = url.split(/[?#]/, 1)[0] || '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

/** Resolves a router URL to its header definition. */
export function resolveNav(url: string): NavEntry {
  const path = toPath(url);
  const exact = NAV_ENTRIES[path];
  if (exact) return exact;
  if (path.startsWith('/support/')) return NAV_ENTRIES['/support/:id'];
  return NO_HEADER;
}
