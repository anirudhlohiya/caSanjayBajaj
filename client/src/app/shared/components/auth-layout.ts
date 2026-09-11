import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-surface-container-lowest text-on-surface font-geist min-h-dvh flex flex-col items-center justify-center antialiased w-full">
      <div class="w-full max-w-md px-4 sm:px-0">
        <!-- Logo -->
        <div class="flex justify-center mb-8">
          <img alt="S N Bajaj And Co Logo" class="h-24 sm:h-32 w-auto object-contain" src="/logo-transparent.png" onerror="this.src='/logo-login.png'">
        </div>
        
        <!-- Auth Container -->
        <div class="bg-canvas-soft border border-hairline rounded-lg p-6 sm:p-8 shadow-[0_1px_0_0_rgba(0,0,0,0.05),0_4px_6px_-1px_rgba(0,0,0,0.02)] dark:shadow-none w-full">
          @if (heroTitle()) {
            <h1 class="font-geist font-semibold text-2xl tracking-[-0.96px] text-center mb-2">{{ heroTitle() }}</h1>
          }
          @if (heroSubtitle()) {
            <p class="font-geist text-sm text-on-surface-variant text-center mb-6">{{ heroSubtitle() }}</p>
          }
          
          <ng-content></ng-content>
        </div>
        
        <footer class="mt-8 text-center">
          <p class="font-geist-mono text-xs tracking-wider text-secondary">Provided to you by S N Bajaj And Co</p>
        </footer>
      </div>
    </div>
  `,
})
export class AuthLayout {
  readonly heroTitle = input<string>();
  readonly heroSubtitle = input<string>();
}
