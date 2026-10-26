import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Faq } from '../entities/faq.entity';
import { CreateFaqDto, UpdateFaqDto } from './dto/faq.dto';

@Injectable()
export class FaqsService {
  constructor(
    @InjectRepository(Faq)
    private readonly faqs: Repository<Faq>,
  ) {}

  listActive(): Promise<Faq[]> {
    return this.faqs.find({
      where: { is_active: true },
      order: { display_order: 'ASC', created_at: 'ASC' },
    });
  }

  listAll(): Promise<Faq[]> {
    return this.faqs.find({
      order: { display_order: 'ASC', created_at: 'ASC' },
    });
  }

  async create(dto: CreateFaqDto): Promise<Faq> {
    const last = await this.faqs.find({
      order: { display_order: 'DESC' },
      take: 1,
    });
    return this.faqs.save(
      this.faqs.create({
        category: dto.category,
        question: dto.question.trim(),
        answer_md: dto.answer_md.trim(),
        is_active: dto.is_active ?? true,
        display_order: (last[0]?.display_order ?? -1) + 1,
      }),
    );
  }

  async update(id: string, dto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.findOne(id);
    if (dto.category !== undefined) faq.category = dto.category;
    if (dto.question !== undefined) faq.question = dto.question.trim();
    if (dto.answer_md !== undefined) faq.answer_md = dto.answer_md.trim();
    if (dto.is_active !== undefined) faq.is_active = dto.is_active;
    return this.faqs.save(faq);
  }

  /** Rewrites display_order to match the given id order. */
  async reorder(ids: string[]): Promise<Faq[]> {
    const rows = await this.faqs.findBy({ id: In(ids) });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const updated = ids
      .map((id, index) => {
        const row = byId.get(id);
        if (row) row.display_order = index;
        return row;
      })
      .filter((r): r is Faq => !!r);
    await this.faqs.save(updated);
    return this.listAll();
  }

  async remove(id: string): Promise<void> {
    await this.faqs.remove(await this.findOne(id));
  }

  private async findOne(id: string): Promise<Faq> {
    const faq = await this.faqs.findOneBy({ id });
    if (!faq) throw new NotFoundException('FAQ not found');
    return faq;
  }
}
