import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteDepartment, RelatedDepartmentModel, CompleteUserRole, RelatedUserRoleModel, CompleteUserSession, RelatedUserSessionModel, CompleteAuditLog, RelatedAuditLogModel, CompleteUserOperationLog, RelatedUserOperationLogModel, CompleteMessage, RelatedMessageModel, CompleteDbBackupJob, RelatedDbBackupJobModel, CompleteRole, RelatedRoleModel, CompleteCustomer, RelatedCustomerModel, CompleteFileUploadSession, RelatedFileUploadSessionModel } from "./index"

export const UserModel = z.object({
  id: z.string(),
  username: z.string().min(2).max(50).meta({ description: '用户名', example: 'admin' }),
  password: z.string().min(6).max(128).meta({ description: '密码（存储哈希值）', example: '123456' }),
  nickname: z.string().max(50).optional().meta({ description: '昵称', example: 'admin' }).nullish(),
  email: z.string().email({ message: '邮箱格式不正确' }).optional().meta({ description: '邮箱', example: 'admin@example.com' }).nullish(),
  phone: z.string().regex(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' }).meta({ description: '手机号', example: '13800138000' }),
  avatar: z.string().url({ message: '头像地址格式不正确' }).optional().meta({ description: '头像 URL', example: 'https://example.com/avatar.png' }).nullish(),
  enabled: z.boolean().optional().meta({ description: '是否启用', example: true }),
  lastLoginAt: z.coerce.date().optional().meta({ description: '最后登录时间', example: '2026-01-01T12:00:00.000Z' }).nullish(),
  lastLoginIp: z.string().max(45).optional().meta({ description: '最后登录 IP', example: '127.0.0.1' }).nullish(),
  lastLoginLocation: z.string().max(100).optional().meta({ description: '最后登录地理位置', example: '中国 广东省 深圳市' }).nullish(),
  remark: z.string().max(500).optional().meta({ description: '备注', example: '备注' }).nullish(),
  passwordChangedAt: z.coerce.date().optional().meta({ description: '密码修改时间', example: '2026-01-01T12:00:00.000Z' }).nullish(),
  departmentId: z.string().optional().meta({ description: '部门 ID', example: 'clxxx' }).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export class UserDto extends createZodDto(UserModel) {
}

export interface CompleteUser extends z.infer<typeof UserModel> {
  department?: CompleteDepartment | null
  roles: CompleteUserRole[]
  sessions: CompleteUserSession[]
  auditLogs: CompleteAuditLog[]
  operationLogs: CompleteUserOperationLog[]
  sentMessages: CompleteMessage[]
  receivedMessages: CompleteMessage[]
  backupJobs: CompleteDbBackupJob[]
  createdRoles: CompleteRole[]
  assignedUserRoles: CompleteUserRole[]
  ownedCustomers: CompleteCustomer[]
  createdCustomers: CompleteCustomer[]
  uploadSessions: CompleteFileUploadSession[]
}

/**
 * RelatedUserModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedUserModel: z.ZodType<CompleteUser> = z.lazy(() => UserModel.extend({
  department: RelatedDepartmentModel.nullish(),
  roles: RelatedUserRoleModel.array(),
  sessions: RelatedUserSessionModel.array(),
  auditLogs: RelatedAuditLogModel.array(),
  operationLogs: RelatedUserOperationLogModel.array(),
  sentMessages: RelatedMessageModel.array(),
  receivedMessages: RelatedMessageModel.array(),
  backupJobs: RelatedDbBackupJobModel.array(),
  createdRoles: RelatedRoleModel.array(),
  assignedUserRoles: RelatedUserRoleModel.array(),
  ownedCustomers: RelatedCustomerModel.array(),
  createdCustomers: RelatedCustomerModel.array(),
  uploadSessions: RelatedFileUploadSessionModel.array(),
}))
