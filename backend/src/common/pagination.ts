export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export function getPagination(
  pageValue: number | string | undefined,
  limitValue: number | string | undefined,
  total: number,
) {
  const parsedPage = Number(pageValue);
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage > 0
      ? Math.max(1, Math.floor(parsedPage))
      : 1;
  const parsedLimit = Number(limitValue);
  const limit =
    Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(parsedLimit)))
      : DEFAULT_PAGE_SIZE;
  const totalPages = Math.ceil(total / limit);

  return {
    page: totalPages === 0 ? 1 : Math.min(requestedPage, totalPages),
    limit,
    totalPages,
  };
}
