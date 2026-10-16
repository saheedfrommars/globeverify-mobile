/**
 * Format a number as a currency string.
 * @param amount The numerical amount to format.
 * @param currency The currency code (e.g., 'USD', 'NGN'). Defaults to 'USD'.
 * @returns Formatted currency string.
 */
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  try {
    const curr = (currency || 'USD').toUpperCase();
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: curr === 'NGN' ? 0 : 2,
      maximumFractionDigits: curr === 'NGN' ? 2 : 2,
    }).format(amount);
  } catch {
    return `${currency === 'NGN' ? '₦' : '$'}${amount.toLocaleString()}`;
  }
};
