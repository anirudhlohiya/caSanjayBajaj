import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { AppSetting } from '../entities/app-setting.entity';
import { Service } from '../entities/service.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketsService } from '../tickets/tickets.service';
import {
  CreateServiceDto,
  ServiceContactDto,
  UpdateServiceDto,
} from './dto/service.dto';

const CONTACT_SETTING_KEY = 'services.contact';

export interface ServiceContact {
  phone: string | null;
  whatsapp: string | null;
}

/** A service as the client app sees it, with contact numbers resolved. */
export type PublicService = Service & { contact: ServiceContact };

@Injectable()
export class ServicesOfferedService {
  constructor(
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
    @InjectRepository(AppSetting)
    private readonly settings: Repository<AppSetting>,
    private readonly tickets: TicketsService,
  ) {}

  async listActive(): Promise<Service[]> {
    return this.services.find({
      where: { is_active: true },
      order: { display_order: 'ASC', created_at: 'ASC' },
    });
  }

  async listAll(): Promise<Service[]> {
    return this.services.find({
      order: { display_order: 'ASC', created_at: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Service> {
    const service = await this.services.findOneBy({ id });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  /** Active service by slug, with the Call / WhatsApp numbers resolved. */
  async findPublic(slug: string): Promise<PublicService> {
    const service = await this.services.findOneBy({ slug, is_active: true });
    if (!service) throw new NotFoundException('Service not found');
    const firm = await this.getContact();
    const override = service.contact_phone || null;
    return {
      ...service,
      contact: {
        phone: override ?? firm.phone,
        whatsapp: override ?? firm.whatsapp ?? firm.phone,
      },
    };
  }

  async create(dto: CreateServiceDto): Promise<Service> {
    const slug = await this.uniqueSlug(dto.slug ?? dto.title);
    const last = await this.services.find({
      order: { display_order: 'DESC' },
      take: 1,
    });
    const service = this.services.create({
      title: dto.title,
      slug,
      description: dto.description,
      tags: cleanTags(dto.tags),
      body_md: dto.body_md ?? '',
      price: dto.price || null,
      icon: dto.icon ?? null,
      icon_color: dto.icon_color ?? null,
      contact_phone: dto.contact_phone || null,
      display_order: dto.display_order ?? (last[0]?.display_order ?? -1) + 1,
      is_active: dto.is_active ?? true,
    });
    return this.services.save(service);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);
    if (dto.slug !== undefined && dto.slug !== service.slug) {
      const taken = await this.services.exists({
        where: { slug: dto.slug, id: Not(id) },
      });
      if (taken) {
        throw new BadRequestException('Another service already uses this URL');
      }
      service.slug = dto.slug;
    }
    if (dto.title !== undefined) service.title = dto.title;
    if (dto.description !== undefined) service.description = dto.description;
    if (dto.tags !== undefined) service.tags = cleanTags(dto.tags);
    if (dto.body_md !== undefined) service.body_md = dto.body_md;
    if (dto.price !== undefined) service.price = dto.price || null;
    if (dto.icon !== undefined) service.icon = dto.icon || null;
    if (dto.icon_color !== undefined) service.icon_color = dto.icon_color;
    if (dto.contact_phone !== undefined) {
      service.contact_phone = dto.contact_phone || null;
    }
    if (dto.display_order !== undefined) {
      service.display_order = dto.display_order;
    }
    if (dto.is_active !== undefined) service.is_active = dto.is_active;
    return this.services.save(service);
  }

  /** Rewrites display_order to match the given id order. */
  async reorder(ids: string[]): Promise<Service[]> {
    const rows = await this.services.findBy({ id: In(ids) });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const updated = ids
      .map((id, index) => {
        const row = byId.get(id);
        if (row) row.display_order = index;
        return row;
      })
      .filter((r): r is Service => !!r);
    await this.services.save(updated);
    return this.listAll();
  }

  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    service.is_active = false;
    await this.services.save(service);
  }

  async getContact(): Promise<ServiceContact> {
    const row = await this.settings.findOneBy({ key: CONTACT_SETTING_KEY });
    const value = (row?.value ?? {}) as Partial<ServiceContact>;
    return { phone: value.phone || null, whatsapp: value.whatsapp || null };
  }

  async setContact(dto: ServiceContactDto): Promise<ServiceContact> {
    const value: ServiceContact = {
      phone: dto.phone?.trim() || null,
      whatsapp: dto.whatsapp?.trim() || null,
    };
    await this.settings.save({ key: CONTACT_SETTING_KEY, value });
    return value;
  }

  /** "Request this service" from the client app → a support ticket. */
  async createEnquiry(
    slug: string,
    userId: string,
    message?: string,
  ): Promise<Ticket> {
    const service = await this.findPublic(slug);
    const note = message?.trim();
    return this.tickets.createForUser(userId, {
      subject: `Service enquiry: ${service.title}`.slice(0, 255),
      category: 'general',
      message: note
        ? `I'm interested in ${service.title}.\n\n${note}`
        : `I'm interested in ${service.title}. Please get in touch with me.`,
    });
  }

  private async uniqueSlug(source: string): Promise<string> {
    const base = slugify(source) || 'service';
    let slug = base;
    for (let n = 2; await this.services.exists({ where: { slug } }); n++) {
      slug = `${base}-${n}`;
    }
    return slug;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function cleanTags(tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  return (tags ?? [])
    .map((t) => t.trim())
    .filter(
      (t) => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()),
    );
}
