import { vi } from 'vitest';

// Jest → Vitest 迁移未完成的 spec 仍调用 jest.fn / jest.mock
Object.assign(globalThis, { jest: vi });
