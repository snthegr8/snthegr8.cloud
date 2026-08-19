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
    "I'm Somtochukwu Nnalue, Leroy to most people. I live in Lagos and build software at Anamen Limited.",
    "I love riding my bicycle, Achilles. Grateful to be human inspired by greats, I live to serve, actively in search of a course. Building @ Alvinn",
  ],
  links: [
    { label: 'Experience', href: '/experience' },
    { label: 'Github', href: 'https://github.com/snthegr8' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/somtonnalue' },
    { label: 'Email Me', href: 'mailto:hello@snthegr8.cloud' },
  ] satisfies HomeLink[],
  recentPostsLimit: 3,
};
