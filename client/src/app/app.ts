import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <div class="min-h-screen sm:bg-slate-50 sm:dark:bg-neutral-900 flex justify-center">
      <div class="w-full sm:w-[420px] min-h-screen bg-surface-container-lowest dark:bg-surface-container-lowest sm:shadow-[0_0_40px_rgba(0,0,0,0.05)] sm:dark:shadow-none sm:border-x sm:border-black/5 sm:dark:border-white/10 relative flex flex-col overflow-x-hidden">
        <router-outlet />
      </div>
    </div>
  `,
})
export class App {
  constructor() {
    const translate = inject(TranslateService);
    const savedLang = localStorage.getItem('fp_language') || 'en';
    translate.setFallbackLang('en');
    translate.use(savedLang);
  }
}
