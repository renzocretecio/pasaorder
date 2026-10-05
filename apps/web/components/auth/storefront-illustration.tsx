export function StorefrontIllustration() {
  return (
    <svg
      viewBox="0 0 480 330"
      fill="none"
      className="mx-auto w-full max-w-[420px]"
      aria-hidden="true"
    >
      <path
        d="M45 308H435"
        stroke="#9ab59d"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M85 142H395V305H85z" fill="#edf1dc" />
      <path d="M107 161H239V276H107z" fill="#173d2c" />
      <path d="M118 172H228V265H118z" fill="#b4c894" />
      <path d="M122 228H224M122 259H224" stroke="#173d2c" strokeWidth="6" />
      <path
        d="M134 228V207a14 14 0 0 1 28 0v21M182 228v-33a14 14 0 0 1 28 0v33"
        fill="#f6f5ef"
      />
      <path d="M138 256v-15h22v15M178 256v-15h27v15" fill="#d7b994" />
      <path d="M262 166a46 46 0 0 1 92 0v139h-92V166Z" fill="#a5bc95" />
      <path d="M274 171a34 34 0 0 1 68 0v134h-68V171Z" fill="#244d35" />
      <path d="M286 174h44v59h-44z" fill="#c9d7b4" />
      <circle cx="328" cy="252" r="3" fill="#d6efa8" />
      <path d="M116 68h248v55H116z" fill="#edf1dc" />
      <text
        x="240"
        y="103"
        textAnchor="middle"
        fill="#173d2c"
        fontSize="22"
        fontWeight="600"
        letterSpacing="-0.5"
      >
        Your store
      </text>
      <path d="M83 120H397L416 150H64L83 120Z" fill="#d6efa8" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <path
          key={i}
          d={`M${64 + i * 44} 150h44v12a22 22 0 0 1-44 0v-12Z`}
          fill={i % 2 === 0 ? "#d6efa8" : "#f6f5ef"}
        />
      ))}
      <path
        d="M107 120h33l-5 30H91l16-30ZM173 120h33l-2 30h-44l13-30ZM239 120h33l3 30h-44l8-30ZM305 120h33l10 30h-44l1-30ZM371 120h26l19 30h-44l-1-30Z"
        fill="#f6f5ef"
      />
      <path
        d="M53 305v-45M53 285c-18 0-24-12-24-23 17 0 24 9 24 23ZM53 274c17 0 24-12 24-23-17 0-24 9-24 23Z"
        stroke="#b4c894"
        strokeWidth="3"
        fill="#b4c894"
      />
      <path d="M36 289h34l-5 17H41l-5-17Z" fill="#d7b994" />
      <path
        d="M384 44h18M393 35v18M58 103h12M64 97v12"
        stroke="#d6efa8"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
