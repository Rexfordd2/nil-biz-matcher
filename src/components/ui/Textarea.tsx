import { forwardRef, TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = forwardRef<HTMLTextAreaElement, Props>(function TextareaBase({ className, ...props }, ref) {
  return <textarea ref={ref} className={clsx('ui-input', className)} {...props} />;
});

export default Textarea;

