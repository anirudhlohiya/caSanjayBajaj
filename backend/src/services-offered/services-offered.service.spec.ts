import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindOperator, Repository } from 'typeorm';
import { AppSetting } from '../entities/app-setting.entity';
import { Service } from '../entities/service.entity';
import { TicketsService } from '../tickets/tickets.service';
import { ServicesOfferedService } from './services-offered.service';

const gst = (overrides: Partial<Service> = {}): Service =>
  ({
    id: 's1',
    slug: 'gst',
    title: 'GST Services',
    description: 'GST work',
    tags: [],
    body_md: '## GST',
    price: null,
    icon: 'receipt_long',
    icon_color: 'blue',
    contact_phone: null,
    display_order: 0,
    is_active: true,
    ...overrides,
  }) as Service;

describe('ServicesOfferedService', () => {
  let rows: Service[];
  let setting: AppSetting | null;
  let services: Record<string, jest.Mock>;
  let settings: Record<string, jest.Mock>;
  let tickets: { createForUser: jest.Mock };
  let service: ServicesOfferedService;

  // Minimal `where` matcher; TypeORM's Not(x) is the only operator used
  const matches = (row: Service, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) =>
      v instanceof FindOperator
        ? row[k as keyof Service] !== v.value
        : row[k as keyof Service] === v,
    );

  beforeEach(() => {
    rows = [gst()];
    setting = null;
    services = {
      findOneBy: jest.fn((where: Record<string, unknown>) =>
        Promise.resolve(rows.find((r) => matches(r, where)) ?? null),
      ),
      exists: jest.fn(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(rows.some((r) => matches(r, where))),
      ),
      find: jest.fn().mockResolvedValue(rows),
      create: jest.fn((v: Partial<Service>) => v),
      save: jest.fn((v: Service) => Promise.resolve(v)),
    };
    settings = {
      findOneBy: jest.fn(() => Promise.resolve(setting)),
      save: jest.fn((v: AppSetting) => {
        setting = v;
        return Promise.resolve(v);
      }),
    };
    tickets = {
      createForUser: jest.fn((_: string, dto: object) =>
        Promise.resolve({ id: 't1', ...dto }),
      ),
    };
    service = new ServicesOfferedService(
      services as unknown as Repository<Service>,
      settings as unknown as Repository<AppSetting>,
      tickets as unknown as TicketsService,
    );
  });

  it('generates a unique slug from the title on create', async () => {
    rows.push(gst({ id: 's2', slug: 'gst-services' }));
    const created = await service.create({
      title: 'GST Services',
      description: 'x',
      tags: [' Refund ', 'refund', 'ITC'],
    });
    expect(created.slug).toBe('gst-services-2');
    expect(created.tags).toEqual(['Refund', 'ITC']);
  });

  it('rejects a slug already used by another service', async () => {
    rows.push(gst({ id: 's2', slug: 'audit' }));
    await expect(service.update('s1', { slug: 'audit' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('resolves firm-wide contact numbers, WhatsApp falling back to phone', async () => {
    setting = {
      key: 'services.contact',
      value: { phone: '9876543210' },
    } as AppSetting;
    const detail = await service.findPublic('gst');
    expect(detail.contact).toEqual({
      phone: '9876543210',
      whatsapp: '9876543210',
    });
  });

  it('uses the per-service number over the firm-wide one', async () => {
    rows[0].contact_phone = '9111111111';
    setting = {
      key: 'services.contact',
      value: { phone: '9876543210', whatsapp: '9000000000' },
    } as AppSetting;
    const detail = await service.findPublic('gst');
    expect(detail.contact).toEqual({
      phone: '9111111111',
      whatsapp: '9111111111',
    });
  });

  it('hides inactive services from the client app', async () => {
    rows[0].is_active = false;
    await expect(service.findPublic('gst')).rejects.toThrow(NotFoundException);
  });

  it('turns an enquiry into a support ticket for the client', async () => {
    await service.createEnquiry('gst', 'u1', 'Need a new registration');
    expect(tickets.createForUser).toHaveBeenCalledWith('u1', {
      subject: 'Service enquiry: GST Services',
      category: 'general',
      message: "I'm interested in GST Services.\n\nNeed a new registration",
    });
  });
});
