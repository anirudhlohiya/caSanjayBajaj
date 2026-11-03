import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <!-- Phone-width column, also on computers. overflow-x-clip (not hidden) keeps the top bar sticky. -->
    <div class="min-h-screen sm:bg-neutral-200 sm:dark:bg-black flex justify-center">
      <div class="w-full sm:w-[420px] min-h-screen bg-surface sm:shadow-[0_0_40px_rgba(0,0,0,0.08)] sm:dark:shadow-none sm:border-x sm:border-black/5 sm:dark:border-white/10 relative flex flex-col overflow-x-clip">
        <router-outlet />
      </div>
    </div>
  `,
})
export class App {
  // Created at the root (not only in the shell) so pages outside the shell,
  // e.g. /documents/upload and /notifications, keep the theme on refresh.
  private readonly theme = inject(ThemeService);

  constructor() {
    const translate = inject(TranslateService);
    const savedLang = localStorage.getItem('fp_language') || 'en';
    translate.setFallbackLang('en');
    translate.use(savedLang);
  }
}
