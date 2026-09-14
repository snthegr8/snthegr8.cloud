export type HomeLink = {
  label: string;
  href: string;
};

export const home = {
  image: {
    src: '/me.png',
    alt: 'Somtochukwu Nnalue',
  },
  lead: {
    prefix: 'building @',
    workplace: {
      label: 'alvinn.app',
      href: 'https://alvinn.app',
    },
    suffix: '.',
  },
  aside:
    'when i am not shipping, i am probably riding my bicycle, watching the mentalist, surfing beats on youtube or studying economics.',
  links: [
    { label: 'experience', href: '/experience' },
    { label: 'github', href: 'https://github.com/snthegr8' },
    { label: 'linkedin', href: 'https://linkedin.com/in/somtonnalue' },
    { label: 'email', href: 'mailto:snthegr8@icloud.com' },
  ] satisfies HomeLink[],
  recentPostsLimit: 4,
};
