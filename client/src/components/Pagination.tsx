import React from 'react'
import { PAGE_SIZE, rangeLabel } from '../utils/searchParams'

export interface PaginationProps {
  page: number
  totalItems: number
  onPage: (page: number) => void
}

/** "21–40 of 45" with Previous / Next (UX-04). */
export const Pagination: React.FC<PaginationProps> = ({ page, totalItems, onPage }) => {
  const lastPage = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" className="pager__btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="pager__range tabular-nums">{rangeLabel(page, totalItems)}</span>
      <button type="button" className="pager__btn" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  )
}
