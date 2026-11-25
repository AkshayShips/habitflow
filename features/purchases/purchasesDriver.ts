import { Platform } from 'react-native';

import type { RcCustomerInfo, RcPackage } from './plans';

/** Boundary over react-native-purchases so the store logic is testable without a device. */
export interface PurchasesDriver {
  logIn(userId: string): Promise<RcCustomerInfo>;
  logOut(): Promise<void>;
  getOfferingPackages(): Promise<RcPackage[]>;
  purchase(packageId: string): Promise<RcCustomerInfo>;
  restore(): Promise<RcCustomerInfo>;
  onCustomerInfo(cb: (info: RcCustomerInfo) => void): void;
}

/** Public iOS SDK key (safe to ship; it is not the secret API key). Absent until RevenueCat is set up. */
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

export async function getNativeDriver(): Promise<PurchasesDriver | null> {
  if (Platform.OS !== 'ios' || !IOS_KEY) return null;
  const { default: Purchases } = await import('react-native-purchases');
  if (!(await Purchases.isConfigured())) Purchases.configure({ apiKey: IOS_KEY });
  let packages: RcPackage[] = [];
  return {
    async logIn(userId) {
      return (await Purchases.logIn(userId)).customerInfo;
    },
    async logOut() {
      // logOut throws if already anonymous; that is fine here.
      await Purchases.logOut().catch(() => undefined);
    },
    async getOfferingPackages() {
      const offerings = await Purchases.getOfferings();
      packages = (offerings.current?.availablePackages ?? []) as unknown as RcPackage[];
      return packages;
    },
    async purchase(packageId) {
      const pkg = packages.find((p) => p.identifier === packageId);
      if (!pkg) throw new Error('package not loaded');
      return (await Purchases.purchasePackage(pkg as never)).customerInfo;
    },
    restore: () => Purchases.restorePurchases(),
    onCustomerInfo(cb) {
      Purchases.addCustomerInfoUpdateListener(cb);
    },
  };
}
