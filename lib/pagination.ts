export type SearchParamValue = string | string[] | undefined;
export type QueryParamValue = string | number | boolean | null | undefined;

export function firstSearchParam(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function buildSearchHref(
  params: Record<string, QueryParamValue>,
  overrides: Record<string, QueryParamValue> = {},
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...params, ...overrides })) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    searchParams.set(key, String(value));
  }

  const query = searchParams.toString();
  return query.length > 0 ? `?${query}` : '?';
}

export function getPaginationState(input: { totalItems: number; page: number; pageSize: number }) {
  const totalPages = Math.max(1, Math.ceil(input.totalItems / input.pageSize));
  const currentPage = Math.min(Math.max(1, input.page), totalPages);
  const skip = (currentPage - 1) * input.pageSize;
  const startItem = input.totalItems === 0 ? 0 : skip + 1;
  const endItem = input.totalItems === 0 ? 0 : Math.min(input.totalItems, skip + input.pageSize);

  return {
    currentPage,
    totalPages,
    skip,
    startItem,
    endItem,
    hasPreviousPage: currentPage > 1,
    hasNextPage: currentPage < totalPages,
  };
}
