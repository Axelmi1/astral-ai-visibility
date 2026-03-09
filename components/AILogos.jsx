import Image from 'next/image';

// All logos normalized to same container — use objectFit contain so every logo
// fills the box without cropping. ChatGPT PNG has extra padding baked in,
// so we scale it slightly larger to compensate.

export const ChatGPTLogo = ({ size = 32 }) => (
  <div style={{ width: size, height: size, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
    <Image
      src="/logos/chatgpt.png"
      width={size}
      height={size}
      alt="ChatGPT"
      style={{ objectFit: 'contain', width: '100%', height: '100%' }}
    />
  </div>
);

export const ClaudeLogo = ({ size = 32 }) => (
  <div style={{ width: size, height: size, position: 'relative', overflow: 'hidden', borderRadius: '50%' }}>
    <Image
      src="/logos/claude.png"
      width={size}
      height={size}
      alt="Claude"
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
    />
  </div>
);

export const PerplexityLogo = ({ size = 32 }) => (
  <div style={{ width: size, height: size, position: 'relative', overflow: 'hidden', borderRadius: '50%' }}>
    <Image
      src="/logos/perplexity.png"
      width={size}
      height={size}
      alt="Perplexity"
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
    />
  </div>
);

export const GeminiLogo = ({ size = 32 }) => (
  <div style={{ width: size, height: size, position: 'relative', overflow: 'hidden', borderRadius: '50%' }}>
    <Image
      src="/logos/gemini.png"
      width={size}
      height={size}
      alt="Gemini"
      style={{ objectFit: 'cover', width: '100%', height: '100%' }}
    />
  </div>
);
