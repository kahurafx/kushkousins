const kes = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0, maximumFractionDigits: 0 }); // min too: older Intl (Hermes) throws on max < currency default

/** Money is stored as integer cents; display whole shillings. */
export const formatKES = (cents: number) => kes.format(cents / 100);
