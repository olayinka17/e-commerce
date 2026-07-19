import { PrismaClient } from "../generated/prisma/client.js";
import { mockDeep, type DeepMockProxy } from "jest-mock-extended";
export type Context = {
  prisma: PrismaClient;
};
export type MockContext = {
  prisma: DeepMockProxy<PrismaClient>;
};
export const createMockContext = (): MockContext => {
  return {
    prisma: mockDeep<PrismaClient>(),
  };
};