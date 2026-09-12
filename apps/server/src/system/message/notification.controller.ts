import { RequiredPermission, User } from "@/processor/decorator/index.js";
import type { JwtUser } from "@/system/auth/dto/auth.dto.js";
import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ReceiversQueryDto,
  SendMailDto,
  SendSystemDto,
} from "./dto/message.dto.js";
import { MessageDeliveryService } from "./message-delivery.service.js";
import { MessageService } from "./message.service.js";

@ApiTags("消息管理")
@Controller("message")
export class NotificationController {
  constructor(
    private readonly messageService: MessageService,
    private readonly delivery: MessageDeliveryService,
  ) {}

  @Get("receivers")
  @ApiOperation({ summary: "获取站内信接收人列表" })
  receivers(@Query() query: ReceiversQueryDto, @User() user: JwtUser) {
    return this.messageService.searchReceivers(query.keyword, user.id);
  }

  @Post("mail")
  @RequiredPermission("notification:send")
  @ApiOperation({ summary: "发送站内信" })
  sendMail(@Body() body: SendMailDto, @User() user: JwtUser) {
    return this.delivery.enqueueMail({
      senderId: user.id,
      receiverIds: body.receiverIds,
      title: body.title,
      content: body.content,
      level: body.level,
    });
  }

  @Post("system")
  @RequiredPermission("notification:send")
  @ApiOperation({ summary: "发送系统通知（全体用户）" })
  sendSystem(@Body() body: SendSystemDto, @User() user: JwtUser) {
    return this.delivery.enqueueSystem({
      senderId: user.id,
      title: body.title,
      content: body.content,
      level: body.level,
    });
  }
}
