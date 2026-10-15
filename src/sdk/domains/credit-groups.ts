import type { Transport } from "../transport.js";
import { CreditGroupAppResultSchema, CreditGroupResultSchema, CreditGroupsResultSchema } from "../types.js";

export interface CreateCreditGroupInput {
  slug: string; displayName: string; chainId: number; treasuryAddress: string; usdcAddress: string;
  packPriceAtomic: string; packCredits: number;
}
export interface ListCreditGroupsInput { appId?: string }
export interface GetCreditGroupInput { groupId: string }
export interface AddCreditGroupAppInput { groupId: string; appId: string; origin: string; creditCost?: number }

export function makeCreditGroupsDomain(t: Transport) {
  return {
    create: (input: CreateCreditGroupInput) => t.post("create-credit-group", input, CreditGroupResultSchema),
    list: (input: ListCreditGroupsInput = {}) => t.post("list-credit-groups", input, CreditGroupsResultSchema),
    get: (input: GetCreditGroupInput) => t.post("get-credit-group", input, CreditGroupResultSchema),
    addApp: (input: AddCreditGroupAppInput) => t.post("add-credit-group-app", input, CreditGroupAppResultSchema),
  };
}
