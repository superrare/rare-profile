import type { Transport } from "../transport.js";
import { CreditGroupAppResultSchema, CreditGroupResultSchema, CreditGroupsResultSchema, CreditGroupGrantResultSchema, CreditGroupUsageResultSchema } from "../types.js";

export type CreditGroupCurrency = "ETH" | "USDC";
export interface CreateCreditGroupInput {
  slug: string; displayName: string; chainId: number; currency: CreditGroupCurrency; tokenAddress: string | null; treasuryAddress: string;
  packPriceAtomic: string; packCredits: number;
}
export interface ListCreditGroupsInput { appId?: string }
export interface GetCreditGroupInput { groupId: string }
export interface CreditGroupUsageInput {
  groupId: string;
  from: string;
  to: string;
  limit?: number;
  afterAppId?: string;
}
export interface AddCreditGroupAppInput { groupId: string; appId: string; origin: string; creditCost?: number }
export interface GrantCreditGroupCreditsInput {
  groupId: string;
  address: string;
  credits: number;
  idempotencyKey: string;
  reason: string;
}
export interface UpdateCreditGroupPaymentInput {
  groupId: string; currency: CreditGroupCurrency; tokenAddress: string | null; treasuryAddress: string;
  packPriceAtomic: string; packCredits: number;
}

export function makeCreditGroupsDomain(t: Transport) {
  return {
    create: (input: CreateCreditGroupInput) => t.post("create-credit-group", input, CreditGroupResultSchema),
    list: (input: ListCreditGroupsInput = {}) => t.post("list-credit-groups", input, CreditGroupsResultSchema),
    get: (input: GetCreditGroupInput) => t.post("get-credit-group", input, CreditGroupResultSchema),
    usage: (input: CreditGroupUsageInput) => t.post("get-credit-group-usage", input, CreditGroupUsageResultSchema),
    addApp: (input: AddCreditGroupAppInput) => t.post("add-credit-group-app", input, CreditGroupAppResultSchema),
    updatePayment: (input: UpdateCreditGroupPaymentInput) => t.post("update-credit-group-payment", input, CreditGroupResultSchema),
    resumePurchases: (input: GetCreditGroupInput) => t.post("resume-credit-group-purchases", input, CreditGroupResultSchema),
    grant: (input: GrantCreditGroupCreditsInput) => t.post("grant-credit-group-credits", input, CreditGroupGrantResultSchema),
  };
}
