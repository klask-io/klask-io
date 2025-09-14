import React from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card' | 'subtle';
  className?: string;
  label?: string;
  'aria-label'?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  indeterminate = false,
  size = 'md',
  variant = 'default',
  className = '',
  label,
  'aria-label': ariaLabel,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(e.target.checked);
    }
  };

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const variantClasses = {
    default: {
      base: 'border-gray-300 text-blue-600 focus:ring-blue-500',
      checked: 'bg-blue-600 border-blue-600',
      hover: 'hover:border-blue-400',
    },
    card: {
      base: 'border-gray-300 text-blue-600 focus:ring-blue-500 shadow-sm',
      checked: 'bg-blue-600 border-blue-600 shadow-md',
      hover: 'hover:border-blue-400 hover:shadow-md',
    },
    subtle: {
      base: 'border-gray-200 text-gray-600 focus:ring-gray-400',
      checked: 'bg-gray-600 border-gray-600',
      hover: 'hover:border-gray-300',
    },
  };

  const classes = clsx(
    // Base classes
    'relative rounded transition-all duration-200 cursor-pointer',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    sizeClasses[size],
    
    // Variant classes
    variantClasses[variant].base,
    
    // State classes
    checked || indeterminate ? variantClasses[variant].checked : variantClasses[variant].hover,
    
    // Disabled state
    disabled && 'opacity-50 cursor-not-allowed',
    
    className
  );

  return (
    <div className="flex items-center">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          className={clsx(classes, 'peer sr-only')}
          aria-label={ariaLabel || label}
        />
        
        {/* Custom checkbox visual */}
        <div
          className={clsx(
            'flex items-center justify-center transition-all duration-200',
            sizeClasses[size],
            'border-2 rounded',
            
            // Base state
            checked || indeterminate
              ? variantClasses[variant].checked
              : 'border-gray-300 bg-white',
            
            // Hover state
            !disabled && !checked && !indeterminate && variantClasses[variant].hover,
            
            // Focus state
            'peer-focus:ring-2 peer-focus:ring-offset-2 peer-focus:ring-blue-500',
            
            // Disabled state
            disabled && 'opacity-50 cursor-not-allowed',
            
            // Interactive state
            !disabled && 'cursor-pointer'
          )}
          onClick={() => !disabled && onChange(!checked)}
        >
          {/* Check icon */}
          {checked && (
            <CheckIcon 
              className={clsx(
                'text-white transition-all duration-200',
                size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4'
              )} 
            />
          )}
          
          {/* Indeterminate state */}
          {indeterminate && !checked && (
            <div 
              className={clsx(
                'bg-white rounded-sm transition-all duration-200',
                size === 'sm' ? 'h-1.5 w-1.5' : size === 'md' ? 'h-2 w-2' : 'h-2.5 w-2.5'
              )}
            />
          )}
        </div>
      </div>
      
      {label && (
        <label 
          className={clsx(
            'ml-2 text-sm text-gray-700 select-none',
            !disabled && 'cursor-pointer',
            disabled && 'opacity-50'
          )}
          onClick={() => !disabled && onChange(!checked)}
        >
          {label}
        </label>
      )}
    </div>
  );
};