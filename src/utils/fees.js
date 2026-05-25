export const DEFAULT_FEE_SETTINGS = {
  companyAppFeeCents: 300,
  depositCents: 2500,
  customerPaysCardProcessingFee: true,
  cardProcessingPercent: 2.9,
  cardProcessingFixedCents: 30,
};

export function calculateCardProcessingFeeCents(totalBeforeCardFeeCents, settings = DEFAULT_FEE_SETTINGS) {
  const customerPays = settings.customerPaysCardProcessingFee ?? DEFAULT_FEE_SETTINGS.customerPaysCardProcessingFee;
  if (!customerPays) return 0;

  const percent = settings.cardProcessingPercent ?? DEFAULT_FEE_SETTINGS.cardProcessingPercent;
  const fixed = settings.cardProcessingFixedCents ?? DEFAULT_FEE_SETTINGS.cardProcessingFixedCents;

  return Math.max(
    0,
    Math.round(((totalBeforeCardFeeCents + fixed) / (1 - percent / 100)) - totalBeforeCardFeeCents),
  );
}

export function calculateDepositPayment(totalAfterDiscountCents = 0, settings = DEFAULT_FEE_SETTINGS) {
  const deposit = settings.depositCents ?? DEFAULT_FEE_SETTINGS.depositCents;
  return Math.max(0, Math.min(Math.round(deposit), Math.max(0, totalAfterDiscountCents)));
}

export function calculateAppFeeCents(settings = DEFAULT_FEE_SETTINGS) {
  return Math.max(0, Math.round(settings.companyAppFeeCents ?? DEFAULT_FEE_SETTINGS.companyAppFeeCents));
}

export function calculateCompanyLedgerCosts(settings = DEFAULT_FEE_SETTINGS) {
  return {
    companyAppFeeCents: calculateAppFeeCents(settings),
    appFeeRoutingStatus: 'ledger_only',
  };
}

export function calculateCustomerCheckoutTotals({
  servicePriceCents = 0,
  travelFeeCents = 0,
  discountCents = 0,
  paymentChoice = 'card_full',
  settings = DEFAULT_FEE_SETTINGS,
}) {
  const subtotalCents = servicePriceCents + travelFeeCents;
  const jobTotalAfterDiscountCents = Math.max(0, subtotalCents - discountCents);
  const appFeeCents = calculateAppFeeCents(settings);
  const amountPaidBeforeAppFeeCents = paymentChoice === 'deposit_cash_balance'
    ? calculateDepositPayment(jobTotalAfterDiscountCents, settings)
    : jobTotalAfterDiscountCents;
  const amountPaidBeforeCardFeeCents = amountPaidBeforeAppFeeCents;
  const cardProcessingFeeCents = calculateCardProcessingFeeCents(amountPaidBeforeCardFeeCents, settings);
  const totalDueTodayCents = amountPaidBeforeCardFeeCents + cardProcessingFeeCents;
  const balanceDueCents = Math.max(0, jobTotalAfterDiscountCents - amountPaidBeforeAppFeeCents);
  const ledger = calculateCompanyLedgerCosts(settings);

  return {
    subtotalCents,
    appFeeCents,
    jobTotalAfterDiscountCents,
    totalBeforeCardFeeCents: amountPaidBeforeCardFeeCents,
    amountPaidBeforeCardFeeCents,
    cardProcessingFeeCents,
    totalDueTodayCents,
    balanceDueCents,
    totalCents: totalDueTodayCents,
    paymentStatus: paymentChoice === 'deposit_cash_balance' ? 'balance_due' : 'paid_full',
    ...ledger,
  };
}
