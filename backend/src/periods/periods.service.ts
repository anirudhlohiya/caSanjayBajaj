import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { CreatePeriodDto, UpdatePeriodDto } from './dto/period.dto';

@Injectable()
export class PeriodsService {
  constructor(
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
  ) {}

  list(): Promise<GstFilingPeriod[]> {
    return this.periods.find({ order: { period_code: 'DESC' } });
  }

  async listOpen(): Promise<GstFilingPeriod[]> {
    return this.periods.find({
      where: { is_open: true },
      order: { period_code: 'DESC' },
    });
  }

  async create(dto: CreatePeriodDto): Promise<GstFilingPeriod> {
    const exists = await this.periods.findOneBy({
      period_code: dto.period_code,
    });
    if (exists) throw new BadRequestException('Period code already exists');
    const period = this.periods.create(dto);
    return this.periods.save(period);
  }

  async findOne(id: string): Promise<GstFilingPeriod> {
    const period = await this.periods.findOneBy({ id });
    if (!period) throw new NotFoundException('Filing period not found');
    return period;
  }

  async update(id: string, dto: UpdatePeriodDto): Promise<GstFilingPeriod> {
    const period = await this.findOne(id);
    Object.assign(period, dto);
    return this.periods.save(period);
  }
}
