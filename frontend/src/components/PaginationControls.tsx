'use client';

export const PAGE_SIZE = 10;

type PaginationControlsProps = {
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  currentPage,
  totalItems,
  onPageChange,
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const page = Math.min(Math.max(currentPage, 1), totalPages);
  const firstItem = (page - 1) * PAGE_SIZE + 1;
  const lastItem = Math.min(page * PAGE_SIZE, totalItems);

  return (
    <div
      aria-label="Pagination"
      className="pagination-controls"
    >
      <span className="pagination-info">
        {firstItem}–{lastItem} of {totalItems}
      </span>
      <div className="pagination-buttons">
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          title="Previous page"
          aria-label="Previous page"
        >
          ‹
        </button>
        <span className="pagination-page-label">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          title="Next page"
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
