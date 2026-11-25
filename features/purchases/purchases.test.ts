import { classifyPurchaseError, isProFromCustomerInfo, toPlans, type RcCustomerInfo, type RcPackage } from './plans';
import { usePurchaseStore } from './purchaseStore';
import type { PurchasesDriver } from './purchasesDriver';

const pkg = (identifier: string, packageType: string, priceString: string): RcPackage => ({
  identifier,
  packageType,
  product: { identifier: `p.${identifier}`, priceString },
});
const pro: RcCustomerInfo = { entitlements: { active: { pro: {} } } };
const free: RcCustomerInfo = { entitlements: { active: {} } };

describe('plans', () => {
  it('detects the pro entitlement only', () => {
    expect(isProFromCustomerInfo(pro)).toBe(true);
    expect(isProFromCustomerInfo(free)).toBe(false);
    expect(isProFromCustomerInfo({ entitlements: { active: { other: {} } } })).toBe(false);
    expect(isProFromCustomerInfo(null)).toBe(false);
  });
  it('orders yearly then monthly using store price strings, skipping other types', () => {
    const plans = toPlans([pkg('m', 'MONTHLY', '₹100'), pkg('w', 'WEEKLY', '₹30'), pkg('y', 'ANNUAL', '₹800')]);
    expect(plans.map((p) => [p.id, p.priceString])).toEqual([['y', '₹800'], ['m', '₹100']]);
  });
  it('drops a package with no price string rather than inventing one', () => {
    expect(toPlans([pkg('y', 'ANNUAL', '')])).toEqual([]);
  });
  it('classifies cancellation', () => {
    expect(classifyPurchaseError({ userCancelled: true })).toBe('cancelled');
    expect(classifyPurchaseError(new Error('x'))).toBe('failed');
    expect(classifyPurchaseError(null)).toBe('failed');
  });
});

function fake(over: Partial<PurchasesDriver> = {}): PurchasesDriver {
  return {
    logIn: async () => free,
    logOut: async () => undefined,
    getOfferingPackages: async () => [pkg('y', 'ANNUAL', '$1')],
    purchase: async () => pro,
    restore: async () => pro,
    onCustomerInfo: () => undefined,
    ...over,
  };
}

describe('purchase store', () => {
  beforeEach(() => usePurchaseStore.setState({ status: 'idle', isPro: false, plans: [] }));

  it('is unavailable without a driver and never pro', async () => {
    await usePurchaseStore.getState().start(null, 'u1');
    expect(usePurchaseStore.getState()).toMatchObject({ status: 'unavailable', isPro: false, plans: [] });
  });
  it('identifies the user, loads plans and becomes ready', async () => {
    const logIn = jest.fn(async () => free);
    await usePurchaseStore.getState().start(fake({ logIn }), 'user-123');
    expect(logIn).toHaveBeenCalledWith('user-123');
    expect(usePurchaseStore.getState().status).toBe('ready');
    expect(usePurchaseStore.getState().plans).toHaveLength(1);
  });
  it('goes to error state when RevenueCat fails', async () => {
    await usePurchaseStore.getState().start(fake({ logIn: async () => { throw new Error('x'); } }), 'u');
    expect(usePurchaseStore.getState().status).toBe('error');
  });
  it('purchase makes the user pro; cancel leaves them free', async () => {
    await usePurchaseStore.getState().start(fake(), 'u');
    expect(await usePurchaseStore.getState().buy('y')).toBe('purchased');
    expect(usePurchaseStore.getState().isPro).toBe(true);
    usePurchaseStore.setState({ isPro: false });
    await usePurchaseStore.getState().start(fake({ purchase: async () => { throw { userCancelled: true }; } }), 'u');
    expect(await usePurchaseStore.getState().buy('y')).toBe('cancelled');
    expect(usePurchaseStore.getState().isPro).toBe(false);
  });
  it('a purchase that does not grant the entitlement is reported as failed', async () => {
    await usePurchaseStore.getState().start(fake({ purchase: async () => free }), 'u');
    expect(await usePurchaseStore.getState().buy('y')).toBe('failed');
  });
  it('restore reports found / nothing / failed', async () => {
    await usePurchaseStore.getState().start(fake(), 'u');
    expect(await usePurchaseStore.getState().restore()).toBe('restored');
    usePurchaseStore.setState({ isPro: false });
    await usePurchaseStore.getState().start(fake({ restore: async () => free }), 'u');
    expect(await usePurchaseStore.getState().restore()).toBe('nothing');
    await usePurchaseStore.getState().start(fake({ restore: async () => { throw new Error('x'); } }), 'u');
    expect(await usePurchaseStore.getState().restore()).toBe('failed');
  });
  it('stop clears pro state', async () => {
    await usePurchaseStore.getState().start(fake({ logIn: async () => pro }), 'u');
    expect(usePurchaseStore.getState().isPro).toBe(true);
    await usePurchaseStore.getState().stop();
    expect(usePurchaseStore.getState()).toMatchObject({ isPro: false, status: 'idle' });
  });
});
