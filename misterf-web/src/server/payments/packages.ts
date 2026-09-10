export type CreditPackageCode = 'credits_200';

export type CreditPackage = {
  code: CreditPackageCode;
  creditedAmountCents: number;
  currency: 'usd';
  customerAmountCents: number;
  description: string;
  label: string;
};

export const creditPackages: Record<CreditPackageCode, CreditPackage> = {
  credits_200: {
    code: 'credits_200',
    creditedAmountCents: 200,
    currency: 'usd',
    customerAmountCents: 500,
    // Internal names: the credits page shows `credits.packageDescription` and
    // `credits.package200` in the buyer's language.
    description: 'Adds many hours of guided practice with Mr. F.',
    label: '200 credits',
  },
};

export const defaultCreditPackage = creditPackages.credits_200;

export function findCreditPackage(code: unknown): CreditPackage | null {
  return code === 'credits_200' ? creditPackages.credits_200 : null;
}
