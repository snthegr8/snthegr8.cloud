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
    "Hi there, greetings to you!",
    "I'm Somtochukwu Nnalue, Leroy to most people, a software developer based in Lagos, Nigeria. I've been building cool apps for over 2 years, and while most of my builds are offline or propietary value offering software, I have two exciting projects cooking for you! During the day, you'd find me at my favorite place, Anamen. By night, as a Dark Knight, I am working on a platform that will offer creators a great deal of value.",
    "When I'm not in front of Kleos, my MacBook, you'd probably find me on my bicycle riding without a worry in mind, or trying to finish up The Mentalist series.",
    "I don't have a handful of friends, so if we share similar interests, or you have a tip for me, want to hang out, or have something valuable to build, feel free to email me below 👇"],
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
