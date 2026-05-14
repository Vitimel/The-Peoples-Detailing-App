export const DEFAULT_FEE_SETTINGS = {
  appFeeFlatCents: 300,
  appFeePercent: 2.5,
  appFeeMinCents: 400,
  appFeeMaxCents: 550,
  customerPaysCardProcessingFee: false,
  cardProcessingPercent: 2.9,
  cardProcessingFixedCents: 30,
};

export function calculateAppFeeCents(subtotalCents, settings = DEFAULT_FEE_SETTINGS) {
  if (Number.isFinite(settings.appFeeFlatCents)) {
    return Math.max(0, Math.round(settings.appFeeFlatCents));
  }

  const percent = settings.appFeePercent ?? DEFAULT_FEE_SETTINGS.appFeePercent;
  const min = settings.appFeeMinCents ?? DEFAULT_FEE_SETTINGS.appFeeMinCents;
  const max = settings.appFeeMaxCents ?? DEFAULT_FEE_SETTINGS.appFeeMaxCents;
  const percentFee = Math.round(subtotalCents * percent / 100);
  return Math.max(min, Math.min(percentFee, max));
}

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

export function calculateCheckoutTotals({
  servicePriceCents = 0,
  travelFeeCents = 0,
  discountCents = 0,
  settings = DEFAULT_FEE_SETTINGS,
}) {
  // INTENTIONAL: App fee is calculated on the pre-discount subtotal (service + travel).
  // Promo discounts reduce what the customer pays but do not reduce the app fee.
  // This is a deliberate product/business decision — do not change this logic.
  const subtotalCents = servicePriceCents + travelFeeCents;
  const appFeeCents = calculateAppFeeCents(subtotalCents, settings);
  const totalBeforeCardFeeCents = subtotalCents - discountCents + appFeeCents;
  const cardProcessingFeeCents = calculateCardProcessingFeeCents(totalBeforeCardFeeCents, settings);
  const totalCents = totalBeforeCardFeeCents + cardProcessingFeeCents;

  return {
    subtotalCents,
    appFeeCents,
    totalBeforeCardFeeCents,
    cardProcessingFeeCents,
    totalCents,
  };
}
