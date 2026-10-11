import React from 'react';

interface VilacEmblemProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const VilacEmblem: React.FC<VilacEmblemProps> = ({ 
  className = '', 
  size = 'md' 
}) => {
  const sizeMap = {
    sm: 'w-10 h-10',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const dimension = sizeMap[size] || 'w-16 h-16';

  return (
    <div className={`relative inline-flex items-center justify-center ${dimension} ${className}`} aria-label="Vilac International School Emblem">
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm select-none"
      >
        {/* Outer Circular Ring with Gold Trim */}
        <circle cx="100" cy="100" r="95" fill="#004D38" stroke="#D4AF37" strokeWidth="4" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" />
        <circle cx="100" cy="100" r="82" fill="#003D2C" stroke="#D4AF37" strokeWidth="2" />

        {/* Circular Text Path */}
        <path
          id="vilac-text-path-top"
          d="M 28 100 A 72 72 0 0 1 172 100"
          fill="none"
        />
        <text fill="#FFFFFF" fontSize="13.5" fontWeight="800" letterSpacing="2" textAnchor="middle">
          <textPath href="#vilac-text-path-top" startOffset="50%">
            VILAC INTL SCHOOL
          </textPath>
        </text>

        <path
          id="vilac-text-path-bottom"
          d="M 168 108 A 70 70 0 0 1 32 108"
          fill="none"
        />
        <text fill="#E6AD00" fontSize="10.5" fontWeight="700" letterSpacing="1.5" textAnchor="middle">
          <textPath href="#vilac-text-path-bottom" startOffset="50%">
            ACCRA &bull; EST. 2008
          </textPath>
        </text>

        {/* Laurel Wreath Accents */}
        <path
          d="M 45 110 C 40 85 55 65 65 60 C 60 72 58 85 62 100"
          stroke="#D4AF37"
          strokeWidth="2.5"
          fill="none"
        />
        <path
          d="M 155 110 C 160 85 145 65 135 60 C 140 72 142 85 138 100"
          stroke="#D4AF37"
          strokeWidth="2.5"
          fill="none"
        />

        {/* Central Heraldic Shield */}
        <path
          d="M 70 65 L 130 65 C 130 95 125 125 100 142 C 75 125 70 95 70 65 Z"
          fill="#FFFFFF"
          stroke="#D4AF37"
          strokeWidth="3.5"
        />

        {/* Shield Internal Partition - Forest Green Upper Half */}
        <path
          d="M 72 67 L 128 67 L 128 92 L 72 92 Z"
          fill="#00563F"
        />

        {/* Open Book of Knowledge in Upper Shield */}
        <g transform="translate(100, 80) scale(0.9)">
          {/* Left Page */}
          <path
            d="M 0 3 C -6 -2 -16 -2 -22 1 L -22 12 C -16 9 -6 9 0 14 Z"
            fill="#FFFFFF"
            stroke="#D4AF37"
            strokeWidth="1.2"
          />
          {/* Right Page */}
          <path
            d="M 0 3 C 6 -2 16 -2 22 1 L 22 12 C 16 9 6 9 0 14 Z"
            fill="#FFFFFF"
            stroke="#D4AF37"
            strokeWidth="1.2"
          />
          {/* Book Spine */}
          <line x1="0" y1="3" x2="0" y2="14" stroke="#004D38" strokeWidth="1.5" />
        </g>

        {/* Golden Torch & Bell in Lower Shield */}
        <g transform="translate(100, 114) scale(0.85)">
          {/* Torch Handle */}
          <path d="M -2 6 L 2 6 L 1 18 L -1 18 Z" fill="#D4AF37" />
          <path d="M -5 5 L 5 5 L 3 8 L -3 8 Z" fill="#E6AD00" />
          {/* Flame */}
          <path
            d="M 0 -8 C 4 -2 5 2 3 5 C 1 7 -1 7 -3 5 C -5 2 -4 -2 0 -8 Z"
            fill="#F4511E"
          />
          <path
            d="M 0 -4 C 2 -1 2 2 1 3 C 0 4 -1 4 -1 3 C -2 2 -2 -1 0 -4 Z"
            fill="#FFD54F"
          />
        </g>

        {/* Lower Banner / Scroll: EXCELLENCE */}
        <path
          d="M 52 145 Q 100 155 148 145 L 142 156 Q 100 166 58 156 Z"
          fill="#D4AF37"
          stroke="#003D2C"
          strokeWidth="1"
        />
        <text
          x="100"
          y="154"
          fill="#003D2C"
          fontSize="7.5"
          fontWeight="900"
          letterSpacing="1.5"
          textAnchor="middle"
        >
          EXCELLENCE
        </text>
      </svg>
    </div>
  );
};
