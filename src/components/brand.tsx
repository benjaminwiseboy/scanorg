export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`font-serif font-semibold tracking-tight ${small ? "text-lg" : "text-2xl"}`}>
      ScanORG<span className="align-super text-[0.55em]">™</span>
    </span>
  );
}
