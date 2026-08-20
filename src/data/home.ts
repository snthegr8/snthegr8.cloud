export type HomeLink = {
  label: string;
  href: string;
};

export const home = {
  image: {
    src: '/me.png',
    alt: 'Somtochukwu Nnalue',
  },
  paragraphs: [
    "Hi there,",
    "I'm Somtochukwu Nnalue, Leroy to most people. Software engineer based in Lagos, Nigeria. Building software at Anamen.",
  ],
  links: [
    { label: 'Experience', href: '/experience' },
    { label: 'Github', href: 'https://github.com/snthegr8' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/somtonnalue' },
    // { label: 'Tools', href: 'https://linkedin.com/in/somtonnalue' },
    // { label: 'Photography', href: '/photography' },
    { label: 'Email Me', href: 'mailto:snthegr8@icloud.com' },
  ] satisfies HomeLink[],
  recentPostsLimit: 3,
};
