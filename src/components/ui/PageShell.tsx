import { PropsWithChildren } from 'react';
import { clsx } from 'clsx';

type Props = PropsWithChildren<{
  className?: string;
}>;

export default function PageShell({ className, children }: Props) {
  return <div className={clsx('page-shell space-y-6', className)}>{children}</div>;
}

