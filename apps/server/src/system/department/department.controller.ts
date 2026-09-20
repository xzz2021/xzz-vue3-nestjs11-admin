import {
  Authenticated,
  RequiredPermission,
  Serialize,
} from '#/processor/decorator/index.js';
import { clientIp } from '#/processor/utils/index.js';
import type { JwtReqDto } from '#/system/auth/dto/auth.dto.js';
import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DepartmentService } from './department.service.js';
import {
  CreateDepartmentDto,
  DeleteDepartmentDto,
  DepartmentListResDto,
  DepartmentLookupResDto,
  DepartmentSeedArrayDto,
  UpdateDepartmentDto,
} from './dto/department.dto.js';

@ApiTags('部门')
@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post('add')
  @RequiredPermission('department:add')
  @ApiOperation({ summary: '添加部门' })
  add(@Body() createDepartmentDto: CreateDepartmentDto, @Req() req: JwtReqDto) {
    return this.departmentService.add(
      createDepartmentDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Get('list')
  @RequiredPermission('department:view')
  @ApiOperation({ summary: '获取部门管理列表' })
  @Serialize(DepartmentListResDto)
  @ApiResponse({ type: DepartmentListResDto, isArray: true })
  findAll() {
    return this.departmentService.findAll();
  }

  @Get('lookup')
  @Authenticated()
  @ApiOperation({ summary: '获取部门精简树, 用于下拉和范围选择' })
  @Serialize(DepartmentLookupResDto)
  @ApiResponse({ type: DepartmentLookupResDto, isArray: true })
  lookupDep() {
    return this.departmentService.lookup();
  }

  @Post('update')
  @RequiredPermission('department:update')
  @ApiOperation({ summary: '更新部门' })
  update(
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @Req() req: JwtReqDto,
  ) {
    return this.departmentService.update(
      updateDepartmentDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Delete('delete')
  @RequiredPermission('department:delete')
  @ApiOperation({ summary: '删除部门', description: '删除部门详细说明' })
  delete(@Body() body: DeleteDepartmentDto, @Req() req: JwtReqDto) {
    return this.departmentService.delete(
      body.id,
      req.user.id,
      clientIp(req.ip),
    );
  }
}
