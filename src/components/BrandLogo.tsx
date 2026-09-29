interface BrandLogoProps {
  className?: string
  size?: number
}

export default function BrandLogo({ className = '', size = 44 }: BrandLogoProps) {
  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-[#16A34A] to-[#0B3D2E] p-2.5 shadow-lg shadow-[#16A34A]/20 border border-white/10 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full text-[#F7F9F8] drop-shadow-sm"
      >
        {/* Modern styled fuel dispenser with stylized "C" flow */}
        {/* Outer pump body */}
        <rect
          x="8"
          y="6"
          width="24"
          height="36"
          rx="5"
          className="stroke-current fill-white/10"
          strokeWidth="3"
        />
        {/* Dispenser display screen */}
        <rect
          x="13"
          y="11"
          width="14"
          height="9"
          rx="2"
          className="fill-[#0A0A0A] stroke-white/20"
          strokeWidth="1.5"
        />
        {/* Stylized drop / flow mark inside screen */}
        <path
          d="M20 13C20 13 17 16.5 17 17.8C17 19 18.3 19.8 20 19.8C21.7 19.8 23 19 23 17.8C23 16.5 20 13 20 13Z"
          fill="#16A34A"
        />
        {/* Fuel nozzle hose hanging on the right forming a dynamic 'C' curve */}
        <path
          d="M32 16H35C37.2091 16 39 17.7909 39 20V33C39 36.3137 36.3137 39 33 39H30"
          className="stroke-current"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Nozzle handle */}
        <path
          d="M37 13L41 17L38 18.5"
          className="stroke-current"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Lower pump panel accent */}
        <line
          x1="13"
          y1="26"
          x2="27"
          y2="26"
          className="stroke-[#16A34A]"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
