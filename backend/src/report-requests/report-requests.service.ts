import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate, PaginatedResult } from '../common/dto/pagination';
import { CreateReportDto } from '../reports/dto/report.dto';
import { ReportRequest } from '../entities/report-request.entity';
import { ReportRequestStatus } from '../common/enums';
import { GstFilingPeriod } from '../entities/gst-filing-period.entity';
import { ReportsService } from '../reports/reports.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateReportRequestDto,
  FulfillReportRequestDto,
  ReportRequestFilterQueryDto,
} from './dto/report-request.dto';

@Injectable()
export class ReportRequestsService {
  private readonly logger = new Logger(ReportRequestsService.name);

  constructor(
    @InjectRepository(ReportRequest)
    private readonly requests: Repository<ReportRequest>,
    @InjectRepository(GstFilingPeriod)
    private readonly periods: Repository<GstFilingPeriod>,
    private readonly reportsService: ReportsService,
    private readonly audit: AuditService,
  ) {}

  async create(auth: AuthUser, dto: CreateReportRequestDto) {
    const period = await this.periods.findOneBy({ id: dto.filing_period_id });
    if (!period) throw new NotFoundException('Filing period not found');

    const existing = await this.requests.findOne({
      where: {
        user_id: auth.sub,
        filing_period_id: dto.filing_period_id,
        status: ReportRequestStatus.PENDING,
      },
    });
    if (existing) {
      throw new BadRequestException(
        'A pending request already exists for this period',
      );
    }

    const request = await this.requests.save(
      this.requests.create({
        user_id: auth.sub,
        filing_period_id: period.id,
        status: ReportRequestStatus.PENDING,
      }),
    );
    return request;
  }

  async listMine(
    auth: AuthUser,
    query: ReportRequestFilterQueryDto,
  ): Promise<PaginatedResult<ReportRequest>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.filing_period', 'period')
      .leftJoinAndSelect('request.fulfilled_report', 'report')
      .where('request.user_id = :uid', { uid: auth.sub })
      .orderBy('request.created_at', 'DESC');

    if (query.status)
      qb.andWhere('request.status = :status', { status: query.status });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async adminList(
    query: ReportRequestFilterQueryDto,
  ): Promise<PaginatedResult<ReportRequest>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.filing_period', 'period')
      .orderBy('request.created_at', 'DESC');

    if (query.status)
      qb.andWhere('request.status = :status', { status: query.status });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  async fulfill(
    auth: AuthUser,
    requestId: string,
    dto: FulfillReportRequestDto,
  ) {
    const request = await this.requests.findOne({
      where: { id: requestId },
      relations: { user: true, filing_period: true },
    });
    if (!request) throw new NotFoundException('Report request not found');
    if (request.status !== ReportRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be fulfilled');
    }
    if (request.user_id !== auth.sub && auth.type !== 'admin') {
      throw new ForbiddenException('Cannot fulfill this request');
    }

    const period = await this.periods.findOneBy({
      id: request.filing_period_id,
    });
    if (!period) throw new NotFoundException('Filing period not found');

    const reportDto: CreateReportDto = {
      user_id: request.user_id,
      filing_period_id: period.id,
      report_type: dto.report_type,
      filename: dto.filename,
      contentType: dto.contentType,
      file_size_bytes: dto.file_size_bytes,
      sales: dto.sales,
      purchases: dto.purchases,
      total_liability: dto.total_liability,
      itc_claimed: dto.itc_claimed,
      net_payable: dto.net_payable,
    };

    const { report_id, upload_url } = await this.reportsService.upload(
      auth,
      reportDto,
    );

    request.status = ReportRequestStatus.FULFILLED;
    request.fulfilled_report_id = report_id;
    request.fulfilled_at = new Date();
    await this.requests.save(request);

    await this.audit.log(
      auth.sub,
      'request.fulfilled',
      { report_request_id: requestId, report_id },
      { user_id: request.user_id },
    );

    return { report_id, upload_url, expires_in: 300 };
  }
}
