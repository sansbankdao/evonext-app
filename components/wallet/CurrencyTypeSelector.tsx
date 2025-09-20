// ./CurrencyTypeSelector.tsx

import { useState } from 'react'
import { Combobox } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'

// 1. (Optional but Recommended) Define a type for your currency object
type Currency = {
    id: number;
    name: string;
    symbol: string;
}

const currencies: Currency[] = [
    { id: 1, name: 'USD', symbol: '$' },
    { id: 2, name: 'EUR', symbol: '€' },
    { id: 3, name: 'JPY', symbol: '¥' },
    { id: 4, name: 'BTC', symbol: '₿' },
    { id: 5, name: 'ETH', symbol: 'Ξ' },
    { id: 6, name: 'DASH', symbol: 'Đ' },
]

export const CurrencyTypeSelector = () => {
    const defaultCurrency = currencies.find(c => c.name === 'DASH') || null;

    // 2. FIX: Change the state type from 'Currency | undefined' to 'Currency | null'
    //    This aligns our state with what Headless UI's Combobox provides.
    const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(defaultCurrency);
    const [query, setQuery] = useState('');

    const filteredCurrencies =
        query === ''
            ? currencies
            : currencies.filter((currency) =>
                  currency.name.toLowerCase().includes(query.toLowerCase())
              );

    return (
        // Now, setSelectedCurrency correctly matches the expected onChange type.
        <Combobox value={selectedCurrency} onChange={setSelectedCurrency}>
            <div className="relative mt-2">
                <Combobox.Input
                    id="combobox"
                    className="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-12 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-sky-600 text-2xl sm:leading-6"
                    // Handle the case where selectedCurrency could be null on initial render
                    displayValue={(currency: Currency | null) => currency?.name || ''}
                    onChange={(event) => setQuery(event.target.value)}
                />
                <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
                    <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                </Combobox.Button>

                {filteredCurrencies.length > 0 && (
                     <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        {filteredCurrencies.map((currency) => (
                           <Combobox.Option key={currency.id} value={currency} className={({ active }) => `relative cursor-default select-none py-2 pl-3 pr-9 ${active ? 'bg-sky-600 text-white' : 'text-gray-900'}`}>
                                {({ active, selected }) => (
                                    <>
                                        <span className={`block truncate ${selected ? 'font-semibold' : ''}`}>{currency.name}</span>
                                        {selected && <span className={`absolute inset-y-0 right-0 flex items-center pr-4 ${active ? 'text-white' : 'text-sky-600'}`}><CheckIcon className="h-5 w-5" aria-hidden="true" /></span>}
                                    </>
                                )}
                            </Combobox.Option>
                        ))}
                    </Combobox.Options>
                )}
            </div>
        </Combobox>
    );
}
