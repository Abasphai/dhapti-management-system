interface PageHeaderProps {
  title: string;
  description?: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-[#002147] md:text-3xl dark:text-slate-100">
        {title}
      </h1>
      {description && (
        <p className="mt-2 text-muted-foreground dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}
