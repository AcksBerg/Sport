export function PageTitle({ children, intro }: { children: string; intro?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-black tracking-tight">{children}</h1>
      {intro && <p className="mt-2 max-w-3xl text-secondary">{intro}</p>}
    </div>
  );
}
