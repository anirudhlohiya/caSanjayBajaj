import { TestBed } from '@angular/core/testing';
import { StaffService } from '../../core/services/feature.services';
import { Staff } from './staff';

describe('Staff permissions switch', () => {
  let staff: Staff;
  const area = (label: string) => staff.areas.find((a) => a.label === label)!;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: StaffService, useValue: {} }] });
    staff = TestBed.runInInjectionContext(() => new Staff());
  });

  it('offers three choices where there is a view level, two otherwise', () => {
    expect(staff.levelsFor(area('Clients')).map((o) => o.value)).toEqual(['none', 'view', 'manage']);
    expect(staff.levelsFor(area('Settings')).map((o) => o.value)).toEqual(['none', 'manage']);
  });

  it('keeps Clients on view while Reports needs it', () => {
    staff.setLevel(area('Reports and filed returns'), 'view');
    expect(staff.levelOf(area('Clients'))).toBe('view');

    staff.setLevel(area('Clients'), 'none');
    expect(staff.levelOf(area('Clients'))).toBe('view');

    staff.setLevel(area('Reports and filed returns'), 'none');
    staff.setLevel(area('Clients'), 'none');
    expect(staff.levelOf(area('Clients'))).toBe('none');
  });
});
