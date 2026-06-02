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
    description: 'Agrega muchas horas de práctica guiada con Mr. F.',
    label: '200 créditos',
  },
};

export const defaultCreditPackage = creditPackages.credits_200;

export function findCreditPackage(code: unknown): CreditPackage | null {
  return code === 'credits_200' ? creditPackages.credits_200 : null;
}
