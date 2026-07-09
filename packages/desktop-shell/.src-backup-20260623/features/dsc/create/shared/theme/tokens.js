export const tokens = {
  background: {
    base: '#030508', // extremely dark navy/black
    // 3DSS style global atmospheric gradient (Intensified for Presents)
    gradient: 'radial-gradient(circle at 20% 35%, rgba(0, 180, 255, 0.22) 0%, transparent 60%), radial-gradient(circle at 78% 62%, rgba(110, 50, 255, 0.20) 0%, transparent 65%), linear-gradient(135deg, rgba(10, 14, 22, 0.2) 0%, rgba(3, 5, 8, 0.9) 100%)',
    panel: 'rgba(10, 14, 22, 0.35)', // Lowered to let gradient breathe
    card: 'rgba(15, 20, 30, 0.35)', // Matching lower opacity
    cardHover: 'rgba(25, 32, 45, 0.85)',
    surface: 'rgba(0, 0, 0, 0.3)',
  },
  border: {
    subtle: '1px solid rgba(255, 255, 255, 0.06)',
    glow: '1px solid rgba(0, 160, 233, 0.3)',
    active: '1px solid rgba(0, 160, 233, 0.8)',
  },
  glow: {
    primary: '0 4px 24px rgba(0, 160, 233, 0.25)',
    secondary: '0 4px 24px rgba(138, 43, 226, 0.15)',
    subtle: 'inset 0 0 20px rgba(138, 43, 226, 0.03)',
  },
  text: {
    primary: '#F0F4F8',
    muted: 'rgba(240, 244, 248, 0.55)',
    accent: '#00A0E9',
  }
};
