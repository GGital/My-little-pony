import React from 'react';
import type { ApiErrorDetail } from '../api/types';

export interface FormFieldErrorProps {
  field: string;
  details?: ApiErrorDetail[];
}

export const FormFieldError: React.FC<FormFieldErrorProps> = ({ field, details }) => {
  const match = details?.find((d) => d.field === field);
  if (!match) return null;

  return (
    <div className="text-danger small mt-1" data-testid={`field-error-${field}`} role="alert">
      {match.message}
    </div>
  );
};
