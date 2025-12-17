import { forwardRef, SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Props = SelectHTMLAttributes<HTMLSelectElement>;

const Select = forwardRef<HTMLSelectElement, Props>(function SelectBase({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={clsx('ui-input', className)} {...props}>
      {children}
    </select>
  );
});

export default Select;

