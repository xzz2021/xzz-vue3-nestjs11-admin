import { Authenticated, RequiredPermission } from "#/processor/decorator/index.js";
import { clientIp } from "#/processor/utils/index.js";
import type { JwtReqDto } from "#/system/auth/dto/auth.dto.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  CreateRoleDto,
  MenuPermissionListRes,
  QueryRoleParams,
  RoleAuthorizationTreeRes,
  RoleListRes,
  RoleSeedArrayDto,
  UpdateRoleDto,
} from "./dto/role.dto.js";
import { RoleService } from "./role.service.js";

@ApiTags("角色")
@Controller("role")
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get("getRoleList")
  @RequiredPermission("role:view")
  @ApiOperation({ summary: "获取角色列表,用于展示" })
  @ApiResponse({ type: RoleListRes })
  findAll(@Query() params: QueryRoleParams) {
    return this.roleService.getRoleList(params);
  }

  @Post("add")
  @RequiredPermission("role:add")
  @ApiOperation({ summary: "创建角色及菜单和权限" })
  create(@Body() createRoleDto: CreateRoleDto, @Req() req: JwtReqDto) {
    return this.roleService.createRoleInfo(
      createRoleDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Post("update")
  @RequiredPermission("role:update")
  @ApiOperation({ summary: "更新角色信息及菜单和权限" })
  update(@Body() updateRoleDto: UpdateRoleDto, @Req() req: JwtReqDto) {
    return this.roleService.update(
      updateRoleDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Get("getRoleMenuAndPer/:id")
  @RequiredPermission("role:view")
  @ApiOperation({ summary: "获取角色菜单及权限列表,用于展示" })
  @ApiResponse({ type: RoleAuthorizationTreeRes })
  getRoleMenuAndPermission(@Param("id") id: string) {
    return this.roleService.getRoleMenuAndPerList(id);
  }

  @Get("getRoleDetail/:id")
  @RequiredPermission("role:view")
  @ApiOperation({ summary: "获取角色详情,用于展示" })
  getRoleDetail(@Param("id") id: string) {
    return this.roleService.getRoleDetail(id);
  }

  // 用户登录瞬间  根据token获取用户信息  获取菜单 以及 权限  进行 去重合并
  //  此处有严重bug  如果返回数据不规则 前端会出现404 且无法清空数据重新登录  前端要优化
  @Get("getRoleMenu")
  @Authenticated()
  @ApiOperation({ summary: "获取当前角色菜单及权限" })
  @ApiResponse({ type: MenuPermissionListRes, isArray: true })
  getMenu(@Req() req: JwtReqDto) {
    const id = req.user.id;
    return this.roleService.findRoleMenu(id);
  }

  @Delete(":id")
  @RequiredPermission("role:delete")
  @ApiOperation({ summary: "删除角色" })
  remove(@Param("id") id: string, @Req() req: JwtReqDto) {
    return this.roleService.remove(id, req.user.id, clientIp(req.ip));
  }

  @Post("generateRoleSeed")
  @RequiredPermission("role:seed")
  @ApiOperation({ summary: "生成角色种子数据" })
  generateRoleSeed(@Body() data: RoleSeedArrayDto) {
    return this.roleService.generateRoleSeed(data.data);
  }
}
