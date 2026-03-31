'use client';

import { SearchableSelect } from '@/components/ui/searchable-select';

export type ProductOption = {
  id: string;
  name: string;
  unitPrice: number;
  currency: 'PEN' | 'USD';
  description: string | null;
};

type Props = {
  products: ProductOption[];
  onSelect: (product: ProductOption) => void;
};

export function ProductSelector({ products, onSelect }: Props) {
  const options = products.map((p) => ({
    value: p.id,
    label: p.name,
    hint: new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: p.currency,
      minimumFractionDigits: 2,
    }).format(p.unitPrice),
  }));

  function handleSelect(id: string) {
    const product = products.find((p) => p.id === id);
    if (product) onSelect(product);
  }

  if (products.length === 0) return null;

  return (
    <SearchableSelect
      options={options}
      value=""
      onValueChange={handleSelect}
      placeholder="Seleccionar del catálogo…"
      searchPlaceholder="Buscar producto…"
      emptyText="Sin productos en el catálogo."
      className="h-8 text-xs"
    />
  );
}
