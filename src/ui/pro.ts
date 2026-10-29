import { createContext, useContext } from 'react';

export const PaywallContext = createContext<{ openPaywall: (reason?: string) => void }>({ openPaywall: () => {} });

export const usePaywall = () => useContext(PaywallContext);

export const PRIVACY_URL = 'https://github.com/keyfive5/IncomeGeneratingApp/blob/main/PRIVACY.md';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
