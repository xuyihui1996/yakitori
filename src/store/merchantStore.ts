import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MerchantState {
    soldOutItems: string[]; // List of names that are sold out
    toggleSoldOut: (itemName: string) => void;
    isSoldOut: (itemName: string) => boolean;
}

export const useMerchantStore = create<MerchantState>()(
    persist(
        (set, get) => ({
            soldOutItems: [],
            toggleSoldOut: (itemName) => {
                set((state) => {
                    const exists = state.soldOutItems.includes(itemName);
                    if (exists) {
                        return { soldOutItems: state.soldOutItems.filter((i) => i !== itemName) };
                    } else {
                        return { soldOutItems: [...state.soldOutItems, itemName] };
                    }
                });
            },
            isSoldOut: (itemName) => get().soldOutItems.includes(itemName),
        }),
        {
            name: 'ordered_merchant_storage',
        }
    )
);
