const kes = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 });

/** Money is stored as integer cents; display whole shillings. */
export const formatKES = (cents: number) => kes.format(cents / 100);
