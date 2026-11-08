import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Official sources for the tax dates and rules shown in the app, and a not-a-government-app notice.
 *  Google Play's Misleading Claims policy requires both wherever government information appears. */
export const GOV_SOURCES = [
  { label: 'GST Portal', href: 'https://www.gst.gov.in' },
  { label: 'CBIC (GST notifications)', href: 'https://cbic-gst.gov.in' },
  { label: 'Income Tax e-Filing', href: 'https://www.incometax.gov.in' },
  { label: 'Income Tax Department (TDS / TCS)', href: 'https://incometaxindia.gov.in' },
];

@Component({
  selector: 'app-gov-sources',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="card p-4 text-[13px] text-on-surface-variant" aria-labelledby="gov-sources-title">
      <p id="gov-sources-title" class="flex items-center gap-2 font-semibold text-on-surface">
        <span class="material-symbols-outlined text-[18px] text-brand-ink" aria-hidden="true">account_balance</span>
        Official sources
      </p>
      <p class="mt-1.5">
        Due dates and tax rules shown in this app come from official government sources. Always check the latest
        notifications there:
      </p>
      <ul class="mt-2 flex flex-col gap-1">
        @for (s of sources; track s.href) {
          <li>
            <a [href]="s.href" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-8 items-center gap-1 font-medium text-link hover:underline">
              {{ s.label }} <span class="text-on-surface-variant">({{ s.href.replace('https://', '') }})</span>
              <span class="material-symbols-outlined text-[14px]" aria-hidden="true">open_in_new</span>
            </a>
          </li>
        }
      </ul>
      <p class="mt-2.5 border-t border-card-border pt-2.5">
        S N Bajaj And Co is a private firm of Chartered Accountants. This app is not a government app and does not
        represent, and is not affiliated with, any government entity.
      </p>
    </aside>
  `,
})
export class GovSources {
  readonly sources = GOV_SOURCES;
}
