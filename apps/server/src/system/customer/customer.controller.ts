import { RequiredPermission, SkipWrap } from "#/processor/decorator/index.js";
import type { AuthorizedJwtRequest } from "#/processor/guard/permission.js";
import { clientIp } from "#/processor/utils/index.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { CustomerService } from "./customer.service.js";
import {
  CreateCustomerDto,
  CustomerDeleteSuccessEnvelopeDto,
  CustomerDetailSuccessEnvelopeDto,
  CustomerListSuccessEnvelopeDto,
  CustomerMutationSuccessEnvelopeDto,
  DeleteCustomerDto,
  ExportCustomerDto,
  QueryCustomerDto,
  UpdateCustomerDto,
} from "./dto/customer.dto.js";

@ApiTags("客户")
@Controller("customer")
export class CustomerController {
  constructor(private readonly customers: CustomerService) {}

  @Get("list")
  @RequiredPermission("customer:view")
  @ApiOperation({ summary: "分页查询客户" })
  @ApiResponse({ status: 200, type: CustomerListSuccessEnvelopeDto })
  list(@Query() query: QueryCustomerDto, @Req() request: AuthorizedJwtRequest) {
    return this.customers.list(query, request.authorizationContext);
  }

  @Get("detail/:id")
  @RequiredPermission("customer:detail")
  @ApiOperation({ summary: "查询客户详情" })
  @ApiResponse({ status: 200, type: CustomerDetailSuccessEnvelopeDto })
  @ApiResponse({ status: 404, description: "客户不存在或无权限" })
  detail(@Param("id") id: string, @Req() request: AuthorizedJwtRequest) {
    return this.customers.detail(id, request.authorizationContext);
  }

  @Post("add")
  @RequiredPermission("customer:add")
  @ApiOperation({ summary: "新增客户" })
  @ApiResponse({ status: 201, type: CustomerMutationSuccessEnvelopeDto })
  add(@Body() dto: CreateCustomerDto, @Req() request: AuthorizedJwtRequest) {
    return this.customers.create(
      dto,
      request.authorizationContext,
      clientIp(request.ip),
    );
  }

  @Post("update")
  @RequiredPermission("customer:update")
  @ApiOperation({ summary: "更新客户" })
  @ApiResponse({ status: 201, type: CustomerMutationSuccessEnvelopeDto })
  @ApiResponse({
    status: 404,
    description: "客户不存在、无权限或当前属性禁止更新",
  })
  @ApiResponse({ status: 409, description: "版本冲突或并发更新冲突" })
  update(@Body() dto: UpdateCustomerDto, @Req() request: AuthorizedJwtRequest) {
    return this.customers.update(
      dto,
      request.authorizationContext,
      clientIp(request.ip),
    );
  }

  @Delete("delete")
  @RequiredPermission("customer:delete")
  @ApiOperation({ summary: "单个或批量删除客户" })
  @ApiResponse({ status: 200, type: CustomerDeleteSuccessEnvelopeDto })
  @ApiResponse({
    status: 404,
    description: "任一客户不存在、无权限或当前属性禁止删除",
  })
  delete(@Body() dto: DeleteCustomerDto, @Req() request: AuthorizedJwtRequest) {
    return this.customers.delete(
      dto.ids,
      request.authorizationContext,
      clientIp(request.ip),
    );
  }

  @Get("export")
  @RequiredPermission("customer:export")
  @SkipWrap()
  @ApiProduces("text/csv")
  @ApiOperation({ summary: "流式导出客户 CSV" })
  @ApiResponse({
    status: 200,
    description: "UTF-8 CSV 文件流",
    content: {
      "text/csv": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async export(
    @Query() query: ExportCustomerDto,
    @Req() request: AuthorizedJwtRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const stream = await this.customers.export(
      query,
      request.authorizationContext,
      clientIp(request.ip),
    );
    const destroyStream = () => {
      if (!stream.destroyed) stream.destroy();
    };
    const closeBeforeFinish = () => {
      if (!response.writableEnded) destroyStream();
    };
    const cleanup = () => {
      request.off("aborted", destroyStream);
      response.off("close", closeBeforeFinish);
      response.off("finish", cleanup);
      stream.off("end", cleanup);
      stream.off("close", cleanup);
    };
    request.once("aborted", destroyStream);
    response.once("close", closeBeforeFinish);
    response.once("finish", cleanup);
    stream.once("end", cleanup);
    stream.once("close", cleanup);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="customers.csv"',
    );
    return new StreamableFile(stream);
  }
}
