import { TestBed } from '@angular/core/testing';
import {
  TranslateLoader,
  TranslateNoOpLoader,
  provideTranslateService,
} from '@ngx-translate/core';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // App resolves the saved language in its constructor, so it needs a
      // TranslateService. The no-op loader keeps the spec off the network.
      providers: [
        provideTranslateService({
          loader: { provide: TranslateLoader, useClass: TranslateNoOpLoader },
        }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
