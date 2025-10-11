/* eslint-disable @typescript-eslint/no-explicit-any */
import { BILLING_PLAN_PRO } from './constants';

export function getBillingPayload(respObj: any, billingCycle: string, proPrice: number) {
  return {
    ...respObj,
    plan: BILLING_PLAN_PRO,
    billingCycle,
    amount: proPrice * 100,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
