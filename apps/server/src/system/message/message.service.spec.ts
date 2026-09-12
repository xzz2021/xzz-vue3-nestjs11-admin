import type { MessageDeliveryService } from "./message-delivery.service.js";
import type { MessageRepository } from "./message.repository.js";
import { MessageService } from "./message.service.js";

describe("MessageService", () => {
  const messages = {
    findInboxPage: jest.fn(),
    count: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    deleteMany: jest.fn(),
    searchReceivers: jest.fn(),
  };
  const delivery = {
    getUnreadCount: jest.fn(),
    refreshUnread: jest.fn(),
    setUnread: jest.fn(),
  };

  const service = new MessageService(
    messages as unknown as MessageRepository,
    delivery as unknown as MessageDeliveryService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lists inbox from repository and unread from delivery", async () => {
    messages.findInboxPage.mockResolvedValue([{ id: "m1" }]);
    messages.count.mockResolvedValue(1);
    delivery.getUnreadCount.mockResolvedValue(2);

    const result = await service.list("u1", { pageIndex: 1, pageSize: 20 });

    expect(messages.findInboxPage).toHaveBeenCalled();
    expect(result).toMatchObject({
      total: 1,
      unread: 2,
      message: "获取消息列表成功",
    });
  });

  it("markRead updates rows then refreshes unread cache", async () => {
    messages.markRead.mockResolvedValue({ count: 2 });
    delivery.refreshUnread.mockResolvedValue(3);

    await expect(service.markRead("u1", ["m1", "m2"])).resolves.toEqual({
      message: "已标记已读",
      count: 2,
      unread: 3,
    });
    expect(delivery.refreshUnread).toHaveBeenCalledWith("u1");
  });
});
