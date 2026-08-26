import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../entities/service.entity';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesOfferedService {
  constructor(
    @InjectRepository(Service)
    private readonly services: Repository<Service>,
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

  async create(dto: CreateServiceDto): Promise<Service> {
    const service = this.services.create({
      title: dto.title,
      description: dto.description,
      price: dto.price ?? null,
      icon: dto.icon ?? null,
      display_order: dto.display_order ?? 0,
      is_active: dto.is_active ?? true,
    });
    return this.services.save(service);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<Service> {
    const service = await this.findOne(id);
    Object.assign(service, dto);
    return this.services.save(service);
  }

  async remove(id: string): Promise<void> {
    const service = await this.findOne(id);
    service.is_active = false;
    await this.services.save(service);
  }
}
