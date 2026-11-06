import React from 'react';
import type { ApiErrorDetail } from '../api/types';
import { Icon } from './Icon';

export interface FormFieldErrorProps {
  field: string;
  details?: ApiErrorDetail[];
}

/** The server's message for one field, shown under it. Its id is `<field>-error`, for aria-describedby. */
export const FormFieldError: React.FC<FormFieldErrorProps> = ({ field, details }) => {
  const match = details?.find((d) => d.field === field);
  if (!match) return null;

  return (
    <div id={`${field}-error`} className="field-error" data-testid={`field-error-${field}`} role="alert">
      <Icon name="alert" size="sm" />
      {match.message}
    </div>
  );
};

/** Props that tie an input to its error: aria-invalid and aria-describedby when the server named this field. */
export function fieldErrorProps(field: string, details?: ApiErrorDetail[]) {
  return details?.some((d) => d.field === field)
    ? { 'aria-invalid': true as const, 'aria-describedby': `${field}-error` }
    : {};
}
