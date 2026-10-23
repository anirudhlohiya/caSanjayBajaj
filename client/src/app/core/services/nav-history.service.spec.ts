import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { NavHistoryService } from './nav-history.service';

@Component({ template: '' })
class Blank {}

describe('NavHistoryService', () => {
  let router: Router;
  let location: Location;
  let history: NavHistoryService;

  const go = async (url: string, replaceUrl = false) => {
    await router.navigateByUrl(url, { replaceUrl });
  };
  /** Waits for any pending (popstate) navigation to finish. */
  const settle = async () => {
    await new Promise((r) => setTimeout(r));
    await TestBed.inject(ApplicationRef).whenStable();
  };
  const back = async () => {
    history.back();
    await settle();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        provideLocationMocks(),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    history = TestBed.inject(NavHistoryService);
    // Subscribes the router to back/forward (popstate) events, as at app start
    router.setUpLocationChangeListener();
  });

  it('goes back to the page the user came from', async () => {
    await go('/dashboard');
    await go('/services/gst');
    expect(history.canGoBack()).toBeTrue();
    await back();
    expect(location.path()).toBe('/dashboard');
  });

  it('falls back to the logical parent when opened straight onto a page', async () => {
    await go('/services/gst');
    expect(history.canGoBack()).toBeFalse();
    await back();
    expect(location.path()).toBe('/services');
  });

  it('does not treat sign-in screens as a back destination', async () => {
    await go('/login');
    await go('/support/42');
    expect(history.canGoBack()).toBeFalse();
    await back();
    expect(location.path()).toBe('/support');
  });

  it('follows browser / hardware back (popstate) without losing track', async () => {
    await go('/dashboard');
    await go('/services');
    await go('/services/gst');
    location.back();
    await settle();
    expect(location.path()).toBe('/services');
    expect(history.canGoBack()).toBeTrue();
    await back();
    expect(location.path()).toBe('/dashboard');
    expect(history.canGoBack()).toBeFalse();
  });

  it('a replaceUrl navigation replaces the current entry', async () => {
    await go('/dashboard');
    await go('/services/gst');
    await go('/support/7', true);
    await back();
    expect(location.path()).toBe('/dashboard');
  });
});
