import { RequiredPermission } from "#/processor/decorator/index.js";
import { clientIp } from "#/processor/utils/index.js";
import type { JwtReqDto } from "#/system/auth/dto/auth.dto.js";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  CreateMenuDto,
  MenuListRes,
  MenuSortArrayDto,
  UpdateMenuDto,
} from "./dto/menu.dto.js";
import { MenuService } from "./menu.service.js";

@ApiTags("菜单")
@Controller("menu")
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post("add")
  @RequiredPermission("menu:add")
  @ApiOperation({ summary: "创建菜单" })
  create(@Body() createMenuDto: CreateMenuDto, @Req() req: JwtReqDto) {
    return this.menuService.create(
      createMenuDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Post("update")
  @RequiredPermission("menu:update")
  @ApiOperation({ summary: "更新菜单" })
  update(@Body() createMenuDto: UpdateMenuDto, @Req() req: JwtReqDto) {
    return this.menuService.update(
      createMenuDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Get("getMenuList")
  @RequiredPermission("menu:view")
  @ApiOperation({ summary: "获取所有菜单嵌套列表, 包含权限, 用于展示管理" })
  @ApiResponse({ type: MenuListRes, isArray: true })
  getMenuList() {
    return this.menuService.findMenuList();
  }

  @Delete(":id")
  @RequiredPermission("menu:delete")
  @ApiOperation({ summary: "删除菜单" })
  remove(@Param("id") id: string, @Req() req: JwtReqDto) {
    return this.menuService.remove(id, req.user.id, clientIp(req.ip));
  }

  @Post("sort")
  @RequiredPermission("menu:update")
  @ApiOperation({ summary: "排序菜单" })
  sort(@Body() data: MenuSortArrayDto) {
    return this.menuService.sortMenu(data.data);
  }
}
