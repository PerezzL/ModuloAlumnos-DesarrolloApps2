import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-[47px] w-full rounded-campo border-[1.5px] border-borde bg-white px-4 text-sm text-texto outline-none transition-colors placeholder:text-placeholder focus:border-primario/60 focus:ring-2 focus:ring-primario/15',
        'aria-invalid:border-[#fca5a5] aria-invalid:bg-[#fff5f5] aria-invalid:focus:ring-peligro/15',
        className,
      )}
      {...props}
    />
  );
}
