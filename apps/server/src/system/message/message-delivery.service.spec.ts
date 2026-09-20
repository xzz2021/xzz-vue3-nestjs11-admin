import { MessageType, NoticeLevel } from "#/prisma/generated/prisma/client.js";
import type { RedisService } from "@liaoliaots/nestjs-redis";
import { BadRequestException } from "@nestjs/common";
import type { Queue } from "bullmq";
import { MessageDeliveryService } from "./message-delivery.service.js";
import type { MessageRepository } from "./message.repository.js";
import { MESSAGE_JOB, MESSAGE_PUSH_CHANNEL } from "./message.constants.js";

describe("MessageDeliveryService", () => {
  const redis = {
    get: vi.fn(),
    set: vi.fn(),
    publish: vi.fn(),
  };
  const queue = {
    add: vi.fn(),
  };
  const messages = {
    findEnabledUserIdsByIds: vi.fn(),
    findEnabledUserIds: vi.fn(),
    findSuperAdminUserIds: vi.fn(),
    countUnread: vi.fn(),
    groupUnreadByReceiverIds: vi.fn(),
    insertDispatched: vi.fn(),
  };

  const createService = () =>
    new MessageDeliveryService(
      messages as unknown as MessageRepository,
      { getOrThrow: () => redis } as unknown as RedisService,
      queue,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue("OK");
    redis.publish.mockResolvedValue(1);
    queue.add.mockResolvedValue({ id: "job-1" });
  });

  it("rejects mailing yourself", async () => {
    await expect(
      createService().enqueueMail({
        senderId: "u1",
        receiverIds: ["u1"],
        title: "hi",
        content: "<p>hello</p>",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("rejects missing or disabled receivers", async () => {
    messages.findEnabledUserIdsByIds.mockResolvedValue([{ id: "u2" }]);

    await expect(
      createService().enqueueMail({
        senderId: "u1",
        receiverIds: ["u2", "u3"],
        title: "hi",
        content: "<p>hello</p>",
      }),
    ).rejects.toThrow("部分接收人不存在或已禁用");
  });

  it("enqueues a sanitized mail job", async () => {
    messages.findEnabledUserIdsByIds.mockResolvedValue([{ id: "u2" }]);

    await createService().enqueueMail({
      senderId: "u1",
      receiverIds: ["u2"],
      title: "  hello  ",
      content: "<p>world</p>",
    });

    expect(queue.add).toHaveBeenCalledWith(
      MESSAGE_JOB,
      expect.objectContaining({
        type: MessageType.MAIL,
        title: "hello",
        senderId: "u1",
        receiverIds: ["u2"],
        dispatchId: expect.any(String),
      }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );
  });

  it("dispatches messages, refreshes unread from db, then publishes ws payload", async () => {
    messages.findSuperAdminUserIds.mockResolvedValue([{ id: "admin-1" }]);
    messages.insertDispatched.mockResolvedValue([
      {
        id: "m1",
        type: MessageType.ALERT,
        title: "down",
        content: "redis failed",
        level: NoticeLevel.WARNING,
        senderId: null,
        receiverId: "admin-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        sender: null,
      },
    ]);
    messages.groupUnreadByReceiverIds.mockResolvedValue([
      { receiverId: "admin-1", _count: { _all: 3 } },
    ]);

    const result = await createService().dispatch({
      dispatchId: "d1",
      type: MessageType.ALERT,
      title: "down",
      content: "redis failed",
    });

    expect(result).toEqual({ count: 1 });
    expect(messages.insertDispatched).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      "message:unread:admin-1",
      "3",
      "EX",
      3600,
    );
    expect(redis.publish).toHaveBeenCalledWith(
      MESSAGE_PUSH_CHANNEL,
      expect.stringContaining('"userId":"admin-1"'),
    );
  });

  it("reads unread count from redis when present", async () => {
    redis.get.mockResolvedValue("7");
    await expect(createService().getUnreadCount("u1")).resolves.toBe(7);
    expect(messages.countUnread).not.toHaveBeenCalled();
  });
});
