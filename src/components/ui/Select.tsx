import React from 'react';

export interface SelectOption {
    label: string;
    value: string | number;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string;
  options?: SelectOption[];
  children?: React.ReactNode;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, id, options, children, className = '', error, ...props }) => {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          {...props}
        >
          {options ? (
              options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                      {opt.label}
                  </option>
              ))
          ) : (
              children
          )}
        </select>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
};
