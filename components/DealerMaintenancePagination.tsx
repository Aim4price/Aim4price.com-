'use client';

import ListPagination from '../components/ListPagination';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import assetStyles from '../app/asset-register/page.module.css';
import leadStyles from '../app/leads/page.module.css';
import paginationStyles from './DealerMaintenancePagination.module.css';
import workspaceStyles from './WorkspacePrimitives.module.css';

const DEFAULT_PAGE_SIZE = 10;
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

  return (
    <div ref={rootRef} className={leadStyles.leadsPage}>
      {children}
      {totalCards > safePageSize ? (
        <div className={`${assetStyles.shell} ${workspaceStyles.shell} ${paginationStyles.paginationShell}`}>
          <div className={`${assetStyles.registerPanel} ${leadStyles.leadsRegisterPanel} ${paginationStyles.paginationPanel}`}>
            <ListPagination label="Maintenance pagination" page={visiblePage} pageCount={totalPages}
              onPageChange={setCurrentPage} summary={<>Showing {rangeStart}–{rangeEnd} of {totalCards} maintenance cards</>} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
