// AES-04: Shared skeleton loader component
import './SharedSkeleton.css';

export default function SharedSkeleton({ width = '60%', height = '20px', style = {} }) {
  return (
    <div
      className="shared-skeleton"
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}
