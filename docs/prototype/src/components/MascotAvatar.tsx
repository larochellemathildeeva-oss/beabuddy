import React from 'react';

export type MascotState = 'idle' | 'thinking' | 'sniffing' | 'running' | 'found';

interface MascotAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  state?: MascotState;
  className?: string;
  onClick?: () => void;
}

export const MascotAvatar: React.FC<MascotAvatarProps> = ({
  size = 'md',
  state = 'idle',
  className = '',
  onClick
}) => {
  const dimensions = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12'
  }[size];

  // Specific transform styles according to state kinematics spec
  const stateStyles = {
    idle: 'animate-pulse duration-[3600ms]',
    thinking: 'rotate-[6deg] -translate-y-0.5 transition-transform duration-[240ms]',
    sniffing: 'scale-x-[1.04] translate-y-0.5 transition-transform duration-[80ms]',
    running: '-translate-y-1 -rotate-[3deg] transition-transform duration-[540ms]',
    found: 'scale-[1.08] -translate-y-1 transition-transform duration-[180ms]'
  }[state];

  return (
    <div
      id="bea-mascot-avatar"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center rounded-full bg-[#F5E6CE] border border-[#E3CCA8] overflow-hidden shadow-xs flex-shrink-0 cursor-pointer ${dimensions} ${className}`}
      title={`Béa - ${state.toUpperCase()}`}
    >
      {/* Handcrafted French Bulldog mascot SVG with cute bandana */}
      <svg
        viewBox="0 0 64 64"
        className={`w-full h-full p-0.5 transition-transform ${stateStyles}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Frenchie Big Bat Ears */}
        {/* Left ear */}
        <path
          d="M18 28C14 16 16 6 22 5C27 4 28 15 27 26"
          fill="#F7EDE2"
          stroke="#5C473A"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19 22C17 14 18 8 22 7C25 6 25 14 24 21"
          fill="#F4A9A8"
          opacity="0.85"
        />

        {/* Right ear */}
        <path
          d="M46 28C50 16 48 6 42 5C37 4 36 15 37 26"
          fill="#F7EDE2"
          stroke="#5C473A"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M45 22C47 14 46 8 42 7C39 6 39 14 40 21"
          fill="#F4A9A8"
          opacity="0.85"
        />

        {/* Head */}
        <path
          d="M20 28C20 23 25 21 32 21C39 21 44 23 44 28C47 34 46 42 41 46C37 49 27 49 23 46C18 42 17 34 20 28Z"
          fill="#FFFBF7"
          stroke="#5C473A"
          strokeWidth="2.5"
        />

        {/* Frenchie eye patches / brindle spot */}
        <path
          d="M21 28C21 25 24 25 26 27C27 29 26 34 24 35C22 36 21 32 21 28Z"
          fill="#E8D5C4"
        />

        {/* Eyes */}
        <circle cx="26" cy="31" r="2.5" fill="#3B2518" />
        <circle cx="38" cy="31" r="2.5" fill="#3B2518" />
        <circle cx="25" cy="30" r="0.8" fill="#FFFFFF" />
        <circle cx="37" cy="30" r="0.8" fill="#FFFFFF" />

        {/* Flat Frenchie Muzzle */}
        <ellipse cx="32" cy="38" rx="8" ry="6" fill="#F4E9DC" stroke="#5C473A" strokeWidth="1.5" />
        {/* Cute black button nose */}
        <path
          d="M29.5 35.5C30.5 35 33.5 35 34.5 35.5C35 36.5 33 38.5 32 38.5C31 38.5 29 36.5 29.5 35.5Z"
          fill="#2C1810"
        />
        {/* Little mouth & tongue */}
        <path
          d="M32 38.5V40.5M30.5 40.5C31 41.5 33 41.5 33.5 40.5"
          stroke="#5C473A"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M31.2 41C31.2 42.5 32.8 42.5 32.8 41Z"
          fill="#F47274"
        />

        {/* Iconic Yellow Bandana with polka pattern */}
        <path
          d="M20 46L32 58L44 46C41 48 23 48 20 46Z"
          fill="#F6C845"
          stroke="#5C473A"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="49" r="1" fill="#FFFFFF" />
        <circle cx="34" cy="51" r="1" fill="#FFFFFF" />
        <circle cx="32" cy="48" r="0.8" fill="#E09228" />
      </svg>
    </div>
  );
};
