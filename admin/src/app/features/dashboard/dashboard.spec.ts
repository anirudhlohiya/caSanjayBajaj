import { TestBed } from '@angular/core/testing';
import {
  DashboardService,
  ReportRequestsService,
  ServiceRequestsAdminService,
} from '../../core/services/feature.services';
import { DashboardStats } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { Dashboard } from './dashboard';

describe('Dashboard', () => {
  let dash: Dashboard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: DashboardService, useValue: {} },
        { provide: AuthService, useValue: {} },
        { provide: ServiceRequestsAdminService, useValue: {} },
        { provide: ReportRequestsService, useValue: {} },
      ],
    });
    dash = TestBed.runInInjectionContext(() => new Dashboard());
  });

  it('scales chart bars to the busiest month and labels them', () => {
    dash.stats.set({
      documents_by_month: [
        { month: '2026-06', count: 0 },
        { month: '2026-07', count: 10 },
        { month: '2026-08', count: 5 },
      ],
    } as DashboardStats);
    const bars = dash.bars();
    expect(bars.map((b) => b.pct)).toEqual([4, 85, 43]);
    expect(bars[1].label).toBe('Jul');
    expect(dash.chartLabel()).toContain('Jul 10');
  });

  it('has no bars when the backend sends no monthly counts', () => {
    dash.stats.set({ documents_by_month: null } as DashboardStats);
    expect(dash.bars()).toEqual([]);
  });

  it('counts whole days to a due date', () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(dash.daysLeft(iso)).toBe(3);
    expect(dash.daysLeft(iso + 'T18:30:00.000Z')).toBe(3);
  });
});
