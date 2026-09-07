interface CustomCardEntry {
  type: string;
  name: string;
  preview?: boolean;
  description?: string;
}

export function registerCustomCard(entry: CustomCardEntry): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  w.customCards = w.customCards || [];
  w.customCards.push({ preview: false, ...entry });
}
