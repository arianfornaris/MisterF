export const creditPackages = {
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
export function findCreditPackage(code) {
    return code === 'credits_200' ? creditPackages.credits_200 : null;
}
//# sourceMappingURL=packages.js.map