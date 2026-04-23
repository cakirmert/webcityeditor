import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[#3a3a3a]',
        primary:
          'bg-[var(--accent)] text-white border border-[var(--accent)] hover:bg-[var(--accent-hover)]',
        destructive:
          'bg-[var(--error)] text-black border border-[var(--error)] hover:opacity-90',
        warn:
          'bg-[var(--warn)] text-black border border-[var(--warn)] hover:opacity-90',
        ghost:
          'text-[var(--text)] hover:bg-[var(--surface-2)] border border-transparent',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-2)]',
      },
      size: {
        default: 'h-7 px-3 py-1',
        sm: 'h-6 px-2',
        icon: 'h-7 w-7 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
