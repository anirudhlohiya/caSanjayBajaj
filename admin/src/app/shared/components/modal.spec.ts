import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Modal } from './modal';

@Component({
  standalone: true,
  imports: [Modal],
  template: `<app-modal [variant]="variant()" [open]="open()" (close)="closed = closed + 1"><p>Body</p></app-modal>`,
})
class Host {
  readonly open = signal(true);
  readonly variant = signal<'dialog' | 'panel'>('panel');
  closed = 0;
}

describe('Modal', () => {
  it('renders the content once in the side panel and closes on Escape', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const dialog = el.querySelector('[role=dialog]')!;
    expect(dialog.className).toContain('h-full');
    expect(el.querySelectorAll('p').length).toBe(1);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closed).toBe(1);
  });

  it('is a centred dialog by default and ignores Escape when closed', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.variant.set('dialog');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role=dialog]').className).toContain('rounded-2xl');

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.closed).toBe(0);
  });
});
