import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard, RolesGuard } from '../common/guards/roles.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, UserIdParamDto } from './dto/user.dto';

@ApiTags('users (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('view_clients')
  @ApiOperation({ summary: 'List client users (paginated)' })
  list(@Query() query: PaginationQueryDto) {
    return this.usersService.list(query);
  }

  @Post()
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Create a client user' })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Get a client user' })
  get(@Param() { id }: UserIdParamDto) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Update a client user' })
  update(@Param() { id }: UserIdParamDto, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('view_clients')
  @ApiOperation({ summary: 'Deactivate a client user' })
  async remove(@Param() { id }: UserIdParamDto) {
    await this.usersService.remove(id);
    return { success: true };
  }
}
