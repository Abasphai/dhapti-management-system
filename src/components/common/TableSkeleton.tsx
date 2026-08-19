import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TableSkeletonProps = {
  columns?: number;
  rows?: number;
  headers?: string[];
};

export function TableSkeleton({
  columns = 5,
  rows = 6,
  headers,
}: TableSkeletonProps) {
  const cols = headers?.length ?? columns;

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-slate-200 bg-slate-100 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/80 dark:hover:bg-slate-800/80">
          {Array.from({ length: cols }).map((_, i) => (
            <TableHead key={i} className="px-4 py-3">
              {headers?.[i] ? (
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {headers[i]}
                </span>
              ) : (
                <Skeleton className="h-3 w-20 bg-slate-200" />
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, r) => (
          <TableRow key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <TableCell key={c} className="px-4 py-3.5">
                <Skeleton
                  className="h-4 bg-slate-200 dark:bg-slate-700"
                  style={{ width: `${55 + ((r + c) % 4) * 10}%` }}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="h-44 animate-pulse rounded-2xl border border-[#E5EBF3] bg-[#002147]/5 dark:border-slate-800 dark:bg-slate-800/40"
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl border border-[#E5EBF3] p-4 dark:border-slate-800"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3 bg-slate-200" />
            <Skeleton className="h-3 w-1/2 bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
