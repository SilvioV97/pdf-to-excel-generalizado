import { bbvaConfig } from './bbva';
import { banbifConfig } from './banbif';

export const banks = {
    [bbvaConfig.id]: bbvaConfig,
    [banbifConfig.id]: banbifConfig,
};

// Default bank to use if none is selected
export const DEFAULT_BANK = bbvaConfig.id;
