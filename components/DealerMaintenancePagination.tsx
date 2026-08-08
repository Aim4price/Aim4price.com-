'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import assetStyles from '../app/asset-register/page.module.css';
import leadStyles from '../app/leads/page.module.css';
import paginationStyles from './DealerMaintenancePagination.module.css';
import workspaceStyles from './WorkspacePrimitives.module.css';

const DEFAULT_PAGE_SIZE = 10;
const PAGINATION_WINDOW = 5;

function ChevronLeftIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ChevronRightIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function maintenanceCards(root: HTMLElement): HTMLElement[] {
  const cards = new Set<HTMLElement>();

  root.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    const label = button.textContent?.replace(/\s+/g, ' ').trim();
    if (label !== 'View maintenance' && label !== 'Close') return;
    const card = button.closest<HTMLElement>('article');
    if (card) cards.add(card);
  });

  return Array.from(cards).sort((left, right) => {
    const position = left.compareDocumentPosition(right);
    return position & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

function pageNumbers(currentPage: number, totalPages: number): number[] {
  const maxButtons = Math.min(PAGINATION_WINDOW, totalPages);
  const halfWindow = Math.floor(maxButtons / 2);
  let startPage = Math.max(1, currentPage - halfWindow);
  const endOverflow = startPage + maxButtons - 1 - totalPages;

  if (endOverflow > 0) startPage = Math.max(1, startPage - endOverflow);
  return Array.from({ length: maxButtons }, (_item, index) => startPage + index);
}

function showPage(cards: HTMLElement[], page: number, pageSize: number) {
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  cards.forEach((card, index) => {
    const shouldShow = index >= startIndex && index < endIndex;
    card.style.display = shouldShow ? '' : 'none';
    if (shouldShow) card.removeAttribute('aria-hidden');
    else card.setAttribute('aria-hidden', 'true');
  });
}

export default function DealerMaintenancePagination({
  children,
  pageSize = DEFAULT_PAGE_SIZE,
  initialOpenAccessId = null,
}: {
  children: ReactNode;
  pageSize?: number;
  initialOpenAccessId?: string | null;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLElement[]>([]);
  const currentPageRef = useRef(1);
  const initialOpenResolvedRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCards, setTotalCards] = useState(0);

  const safePageSize = Math.max(1, Math.trunc(pageSize) || DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(totalCards / safePageSize));
  const visiblePage = Math.min(Math.max(currentPage, 1), totalPages);
  currentPageRef.current = visiblePage;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const syncCards = () => {
      const cards = maintenanceCards(root);
      cardsRef.current = cards;
      const nextTotalPages = Math.max(1, Math.ceil(cards.length / safePageSize));
      let nextPage = Math.min(Math.max(currentPageRef.current, 1), nextTotalPages);

      if (initialOpenAccessId && !initialOpenResolvedRef.current) {
        const openIndex = cards.findIndex((card) => Array.from(card.querySelectorAll('button')).some((button) => button.textContent?.replace(/\s+/g, ' ').trim() === 'Close'));
        if (openIndex >= 0) nextPage = Math.floor(openIndex / safePageSize) + 1;
        initialOpenResolvedRef.current = true;
      }

      currentPageRef.current = nextPage;
      showPage(cards, nextPage, safePageSize);
      setTotalCards(cards.length);
      setCurrentPage((page) => page === nextPage ? page : nextPage);
    };

    syncCards();
    const observer = new MutationObserver(syncCards);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [initialOpenAccessId, safePageSize]);

  useEffect(() => {
    if (currentPage !== visiblePage) setCurrentPage(visiblePage);
    currentPageRef.current = visiblePage;
    showPage(cardsRef.current, visiblePage, safePageSize);
  }, [currentPage, safePageSize, totalCards, visiblePage]);

  const rangeStart = totalCards ? (visiblePage - 1) * safePageSize + 1 : 0;
  const rangeEnd = Math.min(visiblePage * safePageSize, totalCards);
  const pages = pageNumbers(visiblePage, totalPages);

  return (
    <div ref={rootRef} className={leadStyles.leadsPage}>
      {children}
      {totalCards > safePageSize ? (
        <div className={`${assetStyles.shell} ${workspaceStyles.shell} ${paginationStyles.paginationShell}`}>
          <div className={`${assetStyles.registerPanel} ${leadStyles.leadsRegisterPanel} ${paginationStyles.paginationPanel}`}>
            <nav className={`${leadStyles.leadPagination} ${paginationStyles.pagination}`} aria-label="Maintenance pagination">
              <div className={leadStyles.leadPaginationSummary}>
                Showing <strong>{rangeStart}</strong>-<strong>{rangeEnd}</strong> of <strong>{totalCards}</strong> maintenance cards
              </div>
              <div className={leadStyles.leadPaginationControls}>
                <button
                  type="button"
                  className={leadStyles.leadPaginationButton}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={visiblePage <= 1}
                  aria-label="Show previous maintenance page"
                >
                  <ChevronLeftIcon />
                  <span>Previous</span>
                </button>
                <div className={leadStyles.leadPaginationPages}>
                  {pages.map((page) => (
                    <button
                      type="button"
                      key={`maintenance-page-${page}`}
                      className={`${leadStyles.leadPaginationPageButton} ${page === visiblePage ? leadStyles.leadPaginationPageButtonActive : ''}`}
                      onClick={() => setCurrentPage(page)}
                      aria-current={page === visiblePage ? 'page' : undefined}
                      aria-label={`Show maintenance page ${page}`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className={leadStyles.leadPaginationButton}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={visiblePage >= totalPages}
                  aria-label="Show next maintenance page"
                >
                  <span>Next</span>
                  <ChevronRightIcon />
                </button>
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}
