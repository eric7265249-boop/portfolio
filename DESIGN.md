# Chao portfolio design system

The website presents Chen Hao's four independently authored design projects. Preserve project facts, images, original collages, image proportions, eight-chapter case-study order, artist statement, manuals and editing hooks. The identity is the user-selected L05 Cut wordmark; use its 554:172 viewBox ratio, desktop width 120px and mobile width 88px. The original Portfolio entrance cover remains.

## Visual direction

An artifact-led design journal: the physical work and field evidence carry the colour. The interface uses paper #f7f6f2, ink #20211f, secondary ink #60625c, surface #eeede8, hairline #20211f24. Existing project accents identify chapter navigation rather than decorate large surfaces. Fonts are the self-hosted Manrope for interface and body, upright Newsreader for selected display treatments and chapter folios. Body copy is 16–17px on phones and 17px on larger screens, caption 13–14px, interface 12–15px. Display tracking is no tighter than -0.04em; body tracking remains normal.

## Surfaces

- Home: Experience. Retain the Portfolio wordmark cover and radial project index. Rotation, inertia, keyboard alternatives, pause and reduced motion remain available. Suspend the frame loop while offscreen or idle.
- Work: Experience. Large images, film/index switch, category filters, native scrolling. The selected view and category are shareable query parameters. On wide screens the masthead fits one spread; don't spend the first viewport on metadata.
- Projects: Experience transitioning to Read. Keep the D04 expanding cover, horizontal selection and full chapter story. Preserve authored compositions. Batch geometry reads before style writes. Never collect every image's position on every scroll.
- About: Read. Colour portrait, clear introductory essay and chronological record. Keep the supplied CV facts.
- Contact: Operate. Existing contact data stays in its current source. Shared styling handles focus, sizing and reading contrast.

## Interaction

Use native links and buttons. Controls have visible keyboard focus, logical order, 44px touch targets and a clear selected state. Sticky navigation must not cover focused content. Native dialog provides image browsing and Escape dismissal. Reduced-motion users see the static final state. Avoid decorating each section with its own entrance.

## Media and performance

Keep original source assets. Add responsive WebP variants for high-traffic cover images and the portrait; fallback src and image identity remain original. Reserve intrinsic dimensions. Hero is eager/high-priority; below-fold media is lazy. Preload only two critical self-hosted font weights. Intent-based route warming respects data saver and slow connections. Do not claim Core Web Vitals scores without a corresponding measurement.

The current implementation is buildless HTML/CSS/JS in dist, deployed from GitHub main to Vercel. No frontend framework or third-party animation dependency is required.
