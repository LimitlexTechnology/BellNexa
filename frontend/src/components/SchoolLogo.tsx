import React, { useState } from 'react';
import { School } from '../types/database';

interface SchoolLogoProps {
  school: Pick<School, 'name' | 'logo_url' | 'branding_primary'> | null;
  className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({ school, className = '' }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = school?.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'S';

  if (school?.logo_url && !imageFailed) {
    return (
      <img
        src={school.logo_url}
        alt={`${school.name} logo`}
        className={`object-contain rounded-xl bg-white ${className}`}
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      aria-label={`${school?.name ?? 'School'} logo`}
      className={`inline-flex items-center justify-center rounded-xl text-white font-black ${className}`}
      style={{ backgroundColor: school?.branding_primary || '#0A1B45' }}
    >
      {initials}
    </div>
  );
};
