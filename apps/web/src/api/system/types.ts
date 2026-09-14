/*
  id         Int         @id @default(autoincrement())
  username   String      @db.VarChar(50)
  password   String      @db.VarChar(255)
  avatar     String?     @db.VarChar(255)
  email      String?     @unique @db.VarChar(50)
  phone      String      @unique @db.Char(11)
  birthday   String?
  gender     String?     @default("OTHER")
  status     Boolean     @default(true)
  failedLoginCount Int     @default(0) @map("failed_login_count")
  lockLevel        Int     @default(0) @map("lock_level")
  lockedUntil      DateTime? @map("locked_until") 
  lastLoginAt      DateTime? @map("last_login_at")
  lastLoginIp      String? @map("last_login_ip")
  isDeleted Boolean  @default(false) @map("is_deleted")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  wechatId   String?     @unique @map("wechat_id")
  wechatInfo WechatInfo? @relation(fields: [wechatId], references: [unionid])

  */
export interface UserListItem {
  id: number
  username: string
  phone: string
  avatar: string
  email?: string
  birthday: string
  gender: string
  status: boolean
  failedLoginCount: number
  lockLevel: number
  lockedUntil: string
  lastLoginAt: string
  lastLoginIp: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

export interface UserListResponse {
  list: UserListItem[]
  total: number
}
export interface ServerInfoResponse {
  cpu: {
    cpuNum: number
    used: number
    sys: number
    free: number
  }
  mem: {
    total: number
    used: number
    free: number
    usage: number
  }
  sys: {
    computerName: string
    osName: string
    computerIp: string
    osArch: string
  }
  node: {
    title: string
    version: string
    execPath: string
    argv: string
    cwd: string
    uptime: number
  }
  sysFiles: {
    dirName: string
    sysTypeName: string
    typeName: string
    total: number
    free: number
    used: number
    usage: number
  }[]
}
