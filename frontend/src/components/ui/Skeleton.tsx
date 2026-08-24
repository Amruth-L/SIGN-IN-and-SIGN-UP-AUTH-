import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius-sm)',
  className = '',
  style = {},
}) => (
  <div
    className={`skeleton ${className}`}
    style={{ width, height, borderRadius, ...style }}
    aria-hidden="true"
  />
);

/** Skeleton card to mimic a marketplace product card */
export const ProductCardSkeleton: React.FC = () => (
  <div
    style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-card)',
    }}
  >
    {/* Image */}
    <Skeleton height="180px" borderRadius="0" />
    {/* Body */}
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
      <Skeleton width="60%" height="12px" />
      <Skeleton width="90%" height="16px" />
      <Skeleton width="75%" height="12px" />
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <Skeleton width="45%" height="28px" borderRadius="var(--radius-md)" />
        <Skeleton width="45%" height="28px" borderRadius="var(--radius-md)" />
      </div>
    </div>
  </div>
);

/** Skeleton grid of product cards */
export const MarketplaceSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
      gap: '1.25rem',
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
);

export default Skeleton;
