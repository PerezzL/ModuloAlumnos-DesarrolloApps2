import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const variantes = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold transition-[filter,background-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario/40 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primario:
          'bg-linear-[173deg] from-primario to-primario-oscuro text-white shadow-[0_4px_8px_rgb(0_102_255/0.25)] hover:brightness-110',
        fantasma: 'text-texto-suave hover:bg-borde-suave',
      },
      size: {
        md: 'h-10 rounded-item px-4',
        lg: 'h-12 rounded-campo px-6',
        icono: 'size-9 rounded-item',
      },
    },
    defaultVariants: { variant: 'primario', size: 'md' },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof variantes> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(variantes({ variant, size }), className)} {...props} />;
}
