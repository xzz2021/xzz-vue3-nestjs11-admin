import { hash } from "argon2";
import { z } from "zod";

const SeedAdminEnvSchema = z.object({
  SEED_ADMIN_USERNAME: z.string().min(2).max(50),
  SEED_ADMIN_PASSWORD: z.string().min(6).max(128),
  SEED_ADMIN_PHONE: z.string().regex(/^1[3-9]\d{9}$/),
});

export async function createSeedAdmin(env: NodeJS.ProcessEnv) {
  const parsed = SeedAdminEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      "首次初始化需要有效的 SEED_ADMIN_USERNAME、SEED_ADMIN_PASSWORD 和 SEED_ADMIN_PHONE",
    );
  }

  return {
    username: parsed.data.SEED_ADMIN_USERNAME,
    phone: parsed.data.SEED_ADMIN_PHONE,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    password: await hash(parsed.data.SEED_ADMIN_PASSWORD),
  };
}
