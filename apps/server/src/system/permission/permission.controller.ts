import { RequiredPermission } from "#/processor/decorator/index.js";
import { Body, Controller, Delete, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CreatePermissionDto, UpdatePermissionDto } from "./dto/permission.dto.js";
import { PermissionService } from "./permission.service.js";

@ApiTags("权限")
@Controller("permission")
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post("add")
  @RequiredPermission("menu:add")
  @ApiOperation({ summary: "创建权限" })
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionService.create(createPermissionDto);
  }

  @Post("update")
  @RequiredPermission("menu:update")
  @ApiOperation({ summary: "更新权限" })
  update(@Body() updatePermissionDto: UpdatePermissionDto) {
    return this.permissionService.update(updatePermissionDto);
  }

  @Delete(":id")
  @RequiredPermission("menu:delete")
  @ApiOperation({ summary: "删除权限" })
  remove(@Param("id") id: string) {
    return this.permissionService.remove(id);
  }
}
