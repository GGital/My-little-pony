import React from 'react';

export interface SubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  busyLabel?: string;
  children: React.ReactNode;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  busy = false,
  busyLabel,
  disabled,
  children,
  className = '',
  ...props
}) => {
  return (
    <button
      type="submit"
      disabled={disabled || busy}
      aria-busy={busy}
      className={className || undefined}
      {...props}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
};
