import { Authenticated, User } from "#/processor/decorator/index.js";
import type { JwtUser } from "#/system/auth/dto/auth.dto.js";
import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { IdsDto, ListQueryDto } from "./dto/message.dto.js";
import { MessageService } from "./message.service.js";

@ApiTags("消息收件箱")
@Controller("message")
@Authenticated()
export class MessageInboxController {
  constructor(private readonly messageService: MessageService) {}

  @Get("list")
  @ApiOperation({ summary: "我的消息列表" })
  list(@Query() query: ListQueryDto, @User() user: JwtUser) {
    return this.messageService.list(user.id, query);
  }

  @Get("unreadCount")
  async unreadCount(@User() user: JwtUser) {
    const unread = await this.messageService.getUnreadCount(user.id);
    return { unread, message: "ok" };
  }

  @Post("read")
  @ApiOperation({ summary: "标记已读" })
  markRead(@Body() body: IdsDto, @User() user: JwtUser) {
    return this.messageService.markRead(user.id, body.ids);
  }

  @Post("readAll")
  @ApiOperation({ summary: "全部已读" })
  markAllRead(@User() user: JwtUser) {
    return this.messageService.markAllRead(user.id);
  }

  @Delete()
  @ApiOperation({ summary: "删除消息" })
  remove(@Body() body: IdsDto, @User() user: JwtUser) {
    return this.messageService.remove(user.id, body.ids);
  }
}
