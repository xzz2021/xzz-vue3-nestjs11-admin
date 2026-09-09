import { Global, Module } from "@nestjs/common";
import { PgService } from "./pg.service";
@Global()
@Module({
  providers: [PgService],
  exports: [PgService],
})
export class PrismaModule {}

/*


详细查询api教程   https://www.prisma.io/docs/orm/prisma-client/queries
根据数字字段的当前值进行更新


const updatePosts = await prisma.post.updateMany({
  data: {
    views: {
      increment: 1,
    },
    likes: {
      increment: 1,
    },
  },
})


下面是该用户 posts 关系的数量
const relationCount = await prisma.user.findMany({
  include: {
    _count: {
      select: { posts: true },
    },
  },
})

---
[
  {
    id: 1,
    name: "Alice",
    _count: { posts: 3 }
  },
  {
    id: 2,
    name: "Bob",
    _count: { posts: 1 }
  }
]



断开所有相关记录  set: []

const result = await prisma.user.update({
  where: {
    id: 16,
  },
  data: {
    posts: {
      set: [],
    },
  },
  include: {
    posts: true,
  },
})


删除所有相关记  deleteMany

const result = await prisma.user.update({
  where: {
    id: 11,
  },
  data: {
    posts: {
      deleteMany: {},
    },
  },
  include: {
    posts: true,
  },
})

更新所有相关记录  updateMany

const result = await prisma.user.update({
  where: {
    id: 6,
  },
  data: {
    posts: {
      updateMany: {
        where: {
          published: true,
        },
        data: {
          published: false,
        },
      },
    },
  },
  include: {
    posts: true,
  },
})


更新特定的相关记录   update

const result = await prisma.user.update({
  where: {
    id: 6,
  },
  data: {
    posts: {
      update: {
        where: {
          id: 9,
        },
        data: {
          title: 'My updated title',
        },
      },
    },
  },
  include: {
    posts: true,
  },
})



some 、 every 和 none   

increment 、 decrement 、 multiply   divide  set  push


特殊查询--------
aggregate: _count   _avg    _sum   _min  _max

groupBy: 
特殊查询--------



isNot  is  in  notIn  contains  startsWith  endsWith  lt  lte  gt  gte  not  and  or


AND   OR  NOT   

 where: {  content: null }     where: {  content: { not: null  }    





Fluent API  只能返回单个记录的 关联  记录数据

返回特定 User 的所有 Post 记录：

const postsByUser: Post[] = await prisma.user
  .findUnique({ where: { email: 'alice@prisma.io' } })
  .posts()

---------等价于---------------

const postsByUser = await prisma.post.findMany({
  where: {
    author: {
      email: 'alice@prisma.io',
    },
  },
})



标量列表（例如， String[] ）有一组特殊的过滤条件 - 例如，以下查询返回 tags 数组包含 databases 所有帖子：
const posts = await client.post.findMany({
  where: {
    tags: {
      has: 'databases',
    },
  },
})


如果您希望具有 null 值的记录出现在返回数组的开头，请使用 first 
const users = await prisma.user.findMany({
  orderBy: {
    updatedAt: { sort: 'asc', nulls: 'first' },
  },
})


自定义扩展字段  虽然在dto层可以处理  但也可以临时场景 快捷使用

const prisma = new PrismaClient().$extends({
  result: {
    user: {
      fullName: {
        needs: { firstName: true, lastName: true },
        compute(user) {
          return `${user.firstName} ${user.lastName}`
        },
      },
    },
  },
})



json数据查询
{
  "petName": "Claudine",
  "petType": "House cat"
}
const getUsers = await prisma.user.findMany({
  where: {
    extendedPetsData: {
      path: ['petName'],   //   深层嵌套  ['petName', 'a', 'b'  ]  相当于 对象petName.a.b
      equals: 'Claudine',   //  返回 petName 的值为 "Claudine" 的所有用户
      string_contains: 'cat',   //  值包含 "cat" 的所有用户
      array_contains: ['Claudine'],   // 数组包含
      mode: 'insensitive'    //  不区分大小写
    },
  },
})


prisma.log.create({
  data: {
    meta: Prisma.JsonNull,  //  在 Json 字段中插入 null 值
    meta2: Prisma.DbNull,   //  将数据库 NULL 插入到 Json 字段中
  },
})



 @@id(name: "likeId", [postId, userId])  复合唯一id 或复合唯一约束   查询

 const like = await prisma.like.update({
  where: {
    likeId: {
      userId: 1,
      postId: 1,
    },
  },
  data: {
    postId: 2,
  },
})



错误类型  error types

PrismaClientKnownRequestError    已知有错误代码的错误 

P1000 凭据无效  
P1001 无法访问    
P1002  超时  
P1003  数据库不存在  
P1008 操作超时  
P1009 ?  
P1010  用户被拒绝访问 
P1011  TLS 连接时出错
P1012  缺少属性或字段

查询引擎  错误
P2000   值太长
P2001  where 条件记录不存在
P2002   唯一约束失败




PrismaClientUnknownRequestError  没有错误代码的错误

PrismaClientRustPanicError    底层引擎崩溃    必须重新启动  Prisma Client
 
PrismaClientInitializationError   数据库的连接问题

PrismaClientValidationError    数据字段验证错误




在关系数据库中，ID 可以是单个字段，也可以基于多个字段。如果模型没有 @id 或 @@id ，则必须定义一个必需的 @unique 字段或 @@unique 块。

  @@id([firstName, lastName])  // 默认名称 firstName_lastName
  @@id(name: "fullName", fields: [firstName, lastName])  // 自定义名称fullName  否则默认为firstName_lastName


  @@unique([authorId, title])  // authorId 和 title 的组合必须是唯一的
  @@unique(name: "authorTitle", [authorId, title])  // 自定义名称


以下示例定义了一个基于 User 模型的 email 字段和 Address 复合类型的 number 字段的多列唯一约束，该 number 字段用于 User.address 中

  type Address {
  street String
  number Int?
  city String
}

model User {
  id      Int     @id
  email   String
  address Address  //这个类型本身不会单独生成一张数据库表 此处只是相当于限定了address的对象结构  
  addressList Address[]  //  复合类型仅支持有限的一组属性  @default和@map

  @@unique([email, address.number])
}



隐式多对多关系要求两个模型都具有相同的 @id


当你在相同的两个模型之间定义两种关系时，需要在 @relation 属性中添加 name 参数来消除歧义。

model User {
  id           Int     @id @default(autoincrement())
  name         String?
  writtenPosts Post[]
  pinnedPost   Post?
}

model Post {
  id         Int     @id @default(autoincrement())
  title      String?
  author     User    @relation(fields: [authorId], references: [id])
  authorId   Int
  pinnedBy   User?   @relation(fields: [pinnedById], references: [id])
  pinnedById Int?
}


Many-to-many self relations   多对多自我关系

model User {
  id         Int     @id @default(autoincrement())
  name       String?
  followedBy User[]  @relation("UserFollows")
  following  User[]  @relation("UserFollows")
}

等价于

model User {
  id         Int       @id @default(autoincrement())
  name       String?
  followedBy Follows[] @relation("followedBy")
  following  Follows[] @relation("following")
}

model Follows {
  followedBy   User @relation("followedBy", fields: [followedById], references: [id])
  followedById Int
  following    User @relation("following", fields: [followingId], references: [id])
  followingId  Int

  @@id([followingId, followedById])
}

One-to-one self-relations    
“最佳搭子”/配偶：对等配对关系（strictly 一对一）   A 的 bestFriend 是 B，同时 B 的 bestFriend 也是 A

model User {
  id   Int    @id @default(autoincrement())
  name String?

  bestFriendId Int?   @unique
  bestFriend   User?  @relation("BestFriendPair", fields: [bestFriendId], references: [id])
  bestOf       User?  @relation("BestFriendPair")
}

应用场景:  1. 草稿 / 正式版本：影子记录（shadow record）   2. 账户迁移 / 合并的“一对一映射”, 在同一张表里记录“某账号是由哪个旧账号迁移而来”


一对多自关系:  1. 组织结构 / 部门树 / 上下级员工  2. 评论 / 回复（嵌套评论）  3. 树形菜单 / 路由配置  / 结构化文档  4. 邀请 / 推荐关系


多对多自关系:  1. 「关注 / 粉丝」关系  2. 好友（Friendship）——对称的多对多 self  3. 任务依赖图 / 有向图  4. 相关内容 / 相似商品 / 相关标签（一般对称）



级联操作重要设计
如果未指定参考操作，Prisma ORM 将使用以下默认值：1. onDelete	可选关系SetNull 	强制关系Restrict(阻止) 2. onUpdate	可选关系Cascade 	强制关系Cascade

如果删除 Tag ，则使用 Cascade 引用操作， TagOnPosts 中相应的标签分配也会被删除;

model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id     Int          @id @default(autoincrement())
  title  String
  tags   TagOnPosts[]
  User   User?        @relation(fields: [userId], references: [id], onDelete: SetNull, onUpdate: Cascade)
  userId Int?
}

model TagOnPosts {
  id     Int   @id @default(autoincrement())
  post   Post? @relation(fields: [postId], references: [id], onUpdate: Cascade, onDelete: Cascade)
  tag    Tag?  @relation(fields: [tagId], references: [id], onUpdate: Cascade, onDelete: Cascade)
  postId Int?
  tagId  Int?
}

model Tag {
  id    Int          @id @default(autoincrement())
  name  String       @unique
  posts TagOnPosts[]
}




















*/
