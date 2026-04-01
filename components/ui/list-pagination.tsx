import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

type PageToken = number | 'ellipsis';

type ListPaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  startItem?: number;
  endItem?: number;
  hrefForPage: (page: number) => string;
  className?: string;
};

function getVisiblePageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [
      1,
      'ellipsis',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

export function ListPagination({
  currentPage,
  totalPages,
  totalItems,
  startItem,
  endItem,
  hrefForPage,
  className,
}: ListPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageTokens = getVisiblePageTokens(currentPage, totalPages);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        {typeof totalItems === 'number' &&
        typeof startItem === 'number' &&
        typeof endItem === 'number'
          ? `Mostrando ${startItem}-${endItem} de ${totalItems}`
          : `Página ${currentPage} de ${totalPages}`}
      </p>

      <Pagination className="mx-0 w-auto justify-start sm:justify-end">
        <PaginationContent>
          <PaginationItem>
            {currentPage > 1 ? (
              <PaginationPrevious href={hrefForPage(currentPage - 1)} />
            ) : (
              <PaginationPrevious href="#" className="pointer-events-none opacity-50" />
            )}
          </PaginationItem>

          {pageTokens.map((token, index) => (
            <PaginationItem key={`${token}-${index}`}>
              {token === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href={hrefForPage(token)}
                  isActive={token === currentPage}
                  size="default"
                  className="min-w-9"
                >
                  {token}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            {currentPage < totalPages ? (
              <PaginationNext href={hrefForPage(currentPage + 1)} />
            ) : (
              <PaginationNext href="#" className="pointer-events-none opacity-50" />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
