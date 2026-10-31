// Polish long scale, matching the user's reference table. Values remain BigInts.
export const LONG_SCALE = [
  [600, 'centylion'], [60, 'decylion'], [54, 'nonylion'], [48, 'oktylion'],
  [42, 'septylion'], [36, 'sekstylion'], [30, 'kwintylion'], [24, 'kwadrylion'],
  [21, 'tryliard'], [18, 'trylion'], [15, 'biliard'], [12, 'bilion'],
  [9, 'miliard'], [6, 'milion'], [3, 'tysiąc'],
] as const;
