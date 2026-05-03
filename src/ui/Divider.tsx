interface DividerProps {
  sm?: boolean;
}

export function Divider({ sm = false }: DividerProps) {
  return <div className={`pdiv ${sm ? 'pdiv-sm' : ''}`} />;
}
