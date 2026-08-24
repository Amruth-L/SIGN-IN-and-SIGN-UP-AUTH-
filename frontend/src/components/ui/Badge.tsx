import React from 'react';

type BadgeVariant = 'rent' | 'borrow' | 'rent-borrow' | 'condition' | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  'rent':        'badge badge-rent',
  'borrow':      'badge badge-borrow',
  'rent-borrow': 'badge badge-rent',
  'condition':   'badge badge-condition',
  'default':     'badge',
};

const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className = '' }) => {
  return (
    <span className={`${variantClass[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
