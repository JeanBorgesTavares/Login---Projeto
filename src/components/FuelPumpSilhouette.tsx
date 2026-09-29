export default function FuelPumpSilhouette() {
  return (
    <svg
      width="440"
      height="640"
      viewBox="0 0 440 640"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-[#16A34A]"
    >
      <defs>
        <linearGradient id="pumpGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.45" />
          <stop offset="60%" stopColor="#0B3D2E" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16A34A" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#16A34A" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Main Pump Body */}
      <rect
        x="60"
        y="100"
        width="220"
        height="480"
        rx="24"
        fill="url(#pumpGrad)"
        stroke="url(#lineGrad)"
        strokeWidth="2"
      />

      {/* Pump Top Canopy / Hood */}
      <path
        d="M50 110C50 90 70 80 170 80C270 80 290 90 290 110V130H50V110Z"
        fill="url(#pumpGrad)"
        stroke="url(#lineGrad)"
        strokeWidth="2"
      />

      {/* Digital Meter Area */}
      <rect
        x="90"
        y="150"
        width="160"
        height="110"
        rx="12"
        fill="#0A0A0A"
        fillOpacity="0.6"
        stroke="url(#lineGrad)"
        strokeWidth="1.5"
      />
      {/* Decorative meter line readouts */}
      <rect x="110" y="175" width="120" height="12" rx="4" fill="#16A34A" fillOpacity="0.25" />
      <rect x="110" y="200" width="80" height="10" rx="3" fill="#16A34A" fillOpacity="0.18" />
      <rect x="110" y="222" width="100" height="10" rx="3" fill="#16A34A" fillOpacity="0.18" />

      {/* Lower Access Hatch / Grill */}
      <rect
        x="90"
        y="300"
        width="160"
        height="230"
        rx="12"
        fill="none"
        stroke="url(#lineGrad)"
        strokeWidth="1.5"
      />
      {/* Ventilation slots */}
      <line
        x1="110"
        y1="330"
        x2="230"
        y2="330"
        stroke="url(#lineGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="110"
        y1="355"
        x2="230"
        y2="355"
        stroke="url(#lineGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="110"
        y1="380"
        x2="230"
        y2="380"
        stroke="url(#lineGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="110"
        y1="405"
        x2="230"
        y2="405"
        stroke="url(#lineGrad)"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Fuel Hose on the right */}
      <path
        d="M280 220C340 230 380 270 380 340V500C380 540 350 560 320 560"
        stroke="url(#lineGrad)"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />

      {/* Nozzle Holster & Handle */}
      <rect x="270" y="200" width="24" height="40" rx="4" fill="#16A34A" fillOpacity="0.3" />
      <path
        d="M330 150L300 210H270"
        stroke="url(#lineGrad)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="310" cy="180" r="14" fill="#16A34A" fillOpacity="0.2" />

      {/* Ground Base */}
      <rect
        x="30"
        y="580"
        width="280"
        height="24"
        rx="8"
        fill="url(#pumpGrad)"
        stroke="url(#lineGrad)"
        strokeWidth="2"
      />
    </svg>
  )
}
