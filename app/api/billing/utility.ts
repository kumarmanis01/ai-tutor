import { BILLING_PLAN_PRO } from './constants';

export function getBillingPayload(respObj: any, billingCycle: string, proPrice: number) {
  return {
    ...respObj,
    plan: BILLING_PLAN_PRO,
    billingCycle,
    amount: proPrice * 100,
  };
}
