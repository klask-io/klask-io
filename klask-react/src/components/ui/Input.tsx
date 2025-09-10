import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helpText,
  leftIcon,
  rightIcon,
  onRightIconClick,
  className,
  ...props
}, ref) => {
  const inputClasses = clsx(
    'block w-full rounded-lg border shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1',
    {
      'pl-10': leftIcon,
      'pr-10': rightIcon,
      'px-3 py-2': !leftIcon && !rightIcon,
      'border-red-300 focus:border-red-500 focus:ring-red-500': error,
      'border-secondary-300 focus:border-primary-500 focus:ring-primary-500': !error,
    },
    className
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-secondary-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-secondary-400 sm:text-sm">{leftIcon}</span>
          </div>
        )}
        
        <input
          ref={ref}
          className={inputClasses}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            {onRightIconClick ? (
              <button
                type="button"
                onClick={onRightIconClick}
                className="text-secondary-400 hover:text-secondary-600 focus:outline-none"
              >
                {rightIcon}
              </button>
            ) : (
              <span className="text-secondary-400">{rightIcon}</span>
            )}
          </div>
        )}
      </div>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helpText && !error && (
        <p className="mt-1 text-sm text-secondary-500">{helpText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  helpText,
  className,
  ...props
}, ref) => {
  const textareaClasses = clsx(
    'block w-full px-3 py-2 rounded-lg border shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1',
    {
      'border-red-300 focus:border-red-500 focus:ring-red-500': error,
      'border-secondary-300 focus:border-primary-500 focus:ring-primary-500': !error,
    },
    className
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-secondary-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <textarea
        ref={ref}
        className={textareaClasses}
        {...props}
      />
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helpText && !error && (
        <p className="mt-1 text-sm text-secondary-500">{helpText}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helpText?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  error,
  helpText,
  options,
  placeholder,
  className,
  ...props
}, ref) => {
  const selectClasses = clsx(
    'block w-full px-3 py-2 rounded-lg border shadow-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1',
    {
      'border-red-300 focus:border-red-500 focus:ring-red-500': error,
      'border-secondary-300 focus:border-primary-500 focus:ring-primary-500': !error,
    },
    className
  );

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-secondary-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <select
        ref={ref}
        className={selectClasses}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value} 
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {helpText && !error && (
        <p className="mt-1 text-sm text-secondary-500">{helpText}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';