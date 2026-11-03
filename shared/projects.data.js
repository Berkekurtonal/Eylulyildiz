/* ══════════════════════════════════════════════════════════════════
   SHARED — the project archive, one entry per project folder

   The single source for every project page and for the links in the
   ProjectSheets stack. Nothing about a project is written anywhere else.
   This file is published: it holds only what the pages show.

   Rules
   - Every fact comes from the project's own PDF (in
     `sources/projects/<folder>/`, outside the published dist/). Folder and
     file names are never shown, and never written here: which PDF and which
     region each image comes from is kept in tools/project-sources.mjs.
   - Visible copy is written in English, the PDFs' language. Each phrase
     is also a key in shared/translations.js, which holds the Turkish.
     Project titles and people's names are proper names and stay as is.
   - Leave a field out when the PDF does not state it. Every section of a
     page is optional; an empty one is not rendered.
   - The slug is derived from the title (tools/build-project-pages.mjs);
     set `slug` only to keep an address stable after a rename.

   Assets
   Each has an `id` (unique within its section) and `sheet`, the PDF page the
   drawing or render appears on. Images are cut by tools/extract-project-assets.py
   into project-pages/assets/<id>/<section>-<asset id>.jpg, then pages are
   written by tools/build-project-pages.mjs. See README.
   ══════════════════════════════════════════════════════════════════ */

export const PROJECTS = [
  {
    id: 'arche',
    number: '01',
    title: 'ARCHÉ',
    journey: true, // the only immersive project: its sheet is the live PaperJourney frame
    // The source technical sheet the journey resolves at its close; the stack's ARCHÉ
    // sheet settles on it, so every sheet in the stack is a colourless plan.
    hero: { src: 'project-sheets/assets/arche.png', alt: 'ARCHÉ — basement floor plan', sheet: 6 },
    tagline: 'Bridging Digital Innovation & Cultural Heritage',
    summary: 'A three-level building that brings digital innovation into dialogue with cultural heritage: an interactive museum on the ground floor, an archive and laboratories below, offices above.',
    overview: [
      'The basement holds the archive, material conservation and digital heritage laboratories, a model workshop and a staff refectory. The first floor is an open office with a kitchen, meeting room and executive offices.'
    ],
    facts: [
      { label: 'Programme', value: 'Interactive museum · Laboratories · Offices' },
      { label: 'Levels', value: 'Basement, ground and first floor' },
      { label: 'Exhibition area', value: '253 m²' },
      { label: 'Open office', value: '147.5 m²' },
      { label: 'Studio', value: 'IED-STD5', proper: true }
    ],
    concept: {
      statement: 'Nature meets digital heritage.',
      points: [
        { title: 'Virtual reality enhanced archaeology', text: 'Immersive VR experiences allowing interactive exploration of ancient sites.' },
        { title: 'Interactive exhibits & learning spaces', text: 'Hands-on display, 3D scanning of artefacts and educational content bringing history to life.' },
        { title: 'Digital heritage preservation', text: '3D scanning technology to document and preserve Turkey’s archaeology.' },
        { title: 'Sustainable heritage tourism', text: 'Attracting visitors to engage with Turkey’s cultural heritage through technology-driven exhibits.' }
      ],
      assets: [
        { id: 'zoning', sheet: 1, caption: 'Programme zoning, floor by floor' },
        { id: 'site-plan', sheet: 3, caption: 'Site plan' }
      ]
    },
    plans: [
      { id: 'ground-floor', sheet: 5, caption: 'Ground floor plan', scale: '1:50' },
      { id: 'basement', sheet: 6, caption: 'Basement floor plan', scale: '1:50' },
      { id: 'first-floor', sheet: 7, caption: 'First floor plan', scale: '1:50' },
      { id: 'sections', sheet: 4, caption: 'Sections B–B and A–A', scale: '1:50' }
    ],
    spaces: [
      { id: 'experience', sheet: 2, caption: 'Experience area' },
      { id: 'reception', sheet: 2, caption: 'Reception / welcoming' },
      { id: 'general-office', sheet: 2, caption: 'General office' },
      { id: 'exhibition', sheet: 2, caption: 'Experience area' },
      { id: 'ceo-office', sheet: 2, caption: 'CEO office' },
      { id: 'assistant', sheet: 2, caption: 'Assistant area' }
    ],
    details: [
      { id: 'system', sheet: 14, caption: 'Interactive museum system: plan, detail and section', scale: '1:10 · 1:5' },
      { id: 'office-sections', sheet: 16, caption: 'Open office sections with planted separators', scale: '1:20' },
      { id: 'materials', sheet: 2, caption: 'Material board' }
    ]
  },

  {
    id: 'balyan',
    number: '02',
    title: 'BALYAN',
    hero: { src: 'project-sheets/assets/balyan.jpg', alt: 'BALYAN — refunctioned floor plan', sheet: 19 },
    tagline: 'Manufacturing workshop and exhibition area',
    summary: 'A historic adaptive reuse project for the Balyan silver workshop in Büyük Yeni Han, Istanbul, still run by its master craftsman Yeprem Usta.',
    overview: [
      'Improper interventions made to the structure were removed. The first floor became an exhibition space for silver works; the second floor was redesigned as a more modern and comfortable production workshop.',
      'Büyük Yeni Han was built in 1764 in Eminönü, among the structures surrounding the Grand Bazaar. Silver craftsmanship is reported to have moved into the han in the 1980s.'
    ],
    facts: [
      { label: 'Type', value: 'Building survey and refunctioning' },
      { label: 'Location', value: 'Büyük Yeni Han, Eminönü, Istanbul' },
      { label: 'Term', value: '2024–2025 Fall' }
    ],
    concept: {
      statement: 'Preserve the historic character; introduce a contemporary function.',
      points: [
        { title: 'Exhibition area', text: 'Silver works are exhibited and presented on a digital screen.' },
        { title: 'Private idea area', text: 'A room requested by Master Yeprem, where new stories are created for the works.' },
        { title: 'Manufacturing area', text: 'Casting, forming, high-heat and polishing benches for silver production.' }
      ],
      assets: [
        { id: 'sketches', sheet: 6, caption: 'Survey sketches' },
        { id: 'interventions', sheet: 15, caption: 'Intervention map, section a–a' }
      ]
    },
    plans: [
      { id: 'survey', sheet: 7, caption: 'Survey: first and second floor plans', scale: '1:20' },
      { id: 'refunction', sheet: 19, caption: 'Refunctioning: first and second floor plans', scale: '1:20' },
      { id: 'section-a', sheet: 20, caption: 'Refunctional section A–A', scale: '1:20' }
    ],
    spaces: [
      { id: 'manufacturing', sheet: 25, caption: 'Manufacturing area, second floor' },
      { id: 'exhibition', sheet: 25, caption: 'Exhibition area, first floor' },
      { id: 'exhibition-cases', sheet: 25, caption: 'Exhibition area, first floor' },
      { id: 'workbench', sheet: 25, caption: 'Manufacturing area, second floor' },
      { id: 'curtain', sheet: 25, caption: 'Exhibition area, first floor' }
    ],
    details: [
      { id: 'electrical', sheet: 24, caption: 'Electrical and lighting plan', scale: '1:20' },
      { id: 'facade', sheet: 12, caption: 'Facade', scale: '1:20' }
    ]
  },

  {
    id: 'beyond-the-self',
    number: '03',
    title: 'Beyond the Self',
    hero: { src: 'project-sheets/assets/beyond-the-self.jpg', alt: 'Beyond the Self — ground floor plan', sheet: 5 },
    tagline: 'The Inner Journey: A Spatial Experience from Self to Non-Self',
    summary: 'A digital museum inspired by Konya’s Sufi heritage and the teachings of Mevlana. Through light, movement and spatial transitions, visitors pass from fragmentation to wholeness.',
    overview: [
      'The exhibition leads through fragmented, transitional and finally unified spaces. Each layer is a stage of the inner journey: detachment, questioning, dissolution and rebirth. The visitor is not an observer but a participant.'
    ],
    facts: [
      { label: 'Type', value: 'Digital museum · Graduation project' },
      { label: 'Location', value: 'Tantavi Han, Meram, Konya' },
      { label: 'Term', value: '2025–2026 Spring' },
      { label: 'Exhibition area', value: '558.32 m²' }
    ],
    concept: {
      statement: 'Be nothing, so you may become everything.',
      points: [
        { title: 'Fragmentation and quest', text: 'Self and inquiry: a transition beyond appearance.' },
        { title: 'Journey into nothingness', text: 'Nothingness is not an end, it’s a beginning.' },
        { title: 'Return to wholeness', text: 'Return to self: the experience of light and unity.' }
      ],
      assets: [
        { id: 'brochure', sheet: 2, caption: 'Brochure: the three stages of the journey' },
        { id: 'diagrams', sheet: 1, caption: 'Zoning and bubble diagrams' }
      ]
    },
    plans: [
      { id: 'ground-floor', sheet: 4, caption: 'Ground floor plan', scale: '1:50' },
      { id: 'mezzanine', sheet: 6, caption: 'Mezzanine floor plan', scale: '1:50' },
      { id: 'sections', sheet: 12, caption: 'Sections A–A and B–B', scale: '1:50' },
      { id: 'site-plan', sheet: 3, caption: 'Site plan', scale: '1:200' }
    ],
    spaces: [
      { id: 'transition-sphere', sheet: 2, caption: 'The transition sphere to non-existence' },
      { id: 'reception', sheet: 2, caption: 'Reception' },
      { id: 'dynamic-floor', sheet: 2, caption: 'A floor rising like the plains of Konya' },
      { id: 'dome', sheet: 2, caption: 'Interactive geodesic dome' },
      { id: 'nothingness', sheet: 2, caption: 'Exhibition area 4: a state of nothingness' },
      { id: 'cafe', sheet: 2, caption: 'Circular bar and display unit' }
    ],
    details: [
      { id: 'circular-bar', sheet: 20, caption: 'Circular bar and display unit: furniture details', scale: '1:10' },
      { id: 'mezzanine-sections', sheet: 16, caption: 'Mezzanine sections A–A and B–B', scale: '1:20' }
    ]
  },

  {
    id: 'edena',
    number: '04',
    title: 'EDENA',
    hero: { src: 'project-sheets/assets/edena.jpg', alt: 'EDENA — ground floor plan', sheet: 6 },
    tagline: 'Paradise Hidden in the Heart of the City',
    summary: 'A hotel positioned as an oasis of calm that reunites nature and humanity, offering not only a comfortable stay but an experience that soothes the soul.',
    overview: [
      'Ivy hanging from the walls, indoor gardens and a courtyard full of birdsong are designed to help guests reconnect with nature. The name comes from Eden, a symbol of peace and abundance in ancient texts.'
    ],
    facts: [
      { label: 'Type', value: 'Hotel · Urban Oasis' },
      { label: 'Location', value: 'İçerenköy, Ataşehir, Istanbul' },
      { label: 'Levels', value: 'Basement, ground, mezzanine, three floors and a terrace roof' },
      { label: 'Studio', value: 'Interior Architectural Design Studio 4' }
    ],
    concept: {
      statement: 'An urban oasis.',
      points: [
        { title: 'Dense planting', text: 'A combination of dense plants with white and beige colours.' },
        { title: 'A bar like a tree', text: 'A bar area that resembles the trunk of a large tree.' },
        { title: 'Feet in the stream', text: 'A casual environment that feels like putting your feet in the water of a stream.' }
      ],
      assets: [
        { id: 'moodboard', sheet: 1, caption: 'Moodboard: Urban Oasis' },
        { id: 'material-board', sheet: 1, caption: 'Material board' },
        { id: 'site-plan', sheet: 2, caption: 'Site plan' }
      ]
    },
    plans: [
      { id: 'typical-floors', sheet: 3, caption: 'Mezzanine, first and second floor plans', scale: '1:50' },
      { id: 'upper-floors', sheet: 4, caption: 'Third floor plan and terrace roof', scale: '1:50' },
      { id: 'section-a', sheet: 7, caption: 'Section A–A', scale: '1:50', layout: 'half' },
      { id: 'section-b', sheet: 8, caption: 'Section B–B', scale: '1:50', layout: 'half' }
    ],
    spaces: [
      { id: 'bar', sheet: 23, caption: 'Bar' },
      { id: 'lounge', sheet: 23, caption: 'Waiting area' },
      { id: 'reception', sheet: 23, caption: 'Reception' },
      { id: 'double-room', sheet: 23, caption: 'Double room' },
      { id: 'room-corner', sheet: 23, caption: 'Room' },
      { id: 'tree-bar', sheet: 23, caption: 'A bar like a tree' }
    ],
    details: [
      { id: 'partial-plan', sheet: 11, caption: 'First floor partial plan', scale: '1:20' },
      { id: 'ceiling', sheet: 13, caption: 'First floor ceiling plan', scale: '1:20' },
      { id: 'room-sections', sheet: 14, caption: 'First floor sections A–A and B–B', scale: '1:20' }
    ]
  },

  {
    id: 'los-platos-de-frida',
    number: '05',
    title: 'LOS PLATOS DE FRIDA',
    hero: { src: 'project-sheets/assets/los-platos-de-frida.jpg', alt: 'LOS PLATOS DE FRIDA — floor plan', sheet: 4 },
    tagline: 'Frida’s Plates',
    summary: 'A concept restaurant inspired by the way Frida Kahlo transferred Mexican culture and revolutionary national identity to canvas. A different festival is celebrated every month: not only a dining experience, but a cultural journey.',
    overview: [
      'Brown, orange, green, navy blue and pink create a lively, dynamic interior. Glass mirrors on the ceiling above the dining tables add depth; sombrero hats are exhibited at the entrance.'
    ],
    facts: [
      { label: 'Type', value: 'Concept restaurant · Mexican cuisine' },
      { label: 'Location', value: 'Hilltown shopping mall' },
      { label: 'Studio', value: 'Interior Design Studio III' }
    ],
    concept: {
      statement: 'Not only a dining experience, but a cultural journey.',
      points: [
        { title: 'A festival every month', text: 'Special decorations and menus, as for Día de los Muertos.' },
        { title: 'Ceiling mirrors', text: 'Inspired by Frida Kahlo’s art, placed above the dining tables.' },
        { title: 'Day of the Dead', text: 'Frida Kahlo paintings, colourful flowers and patterned skeletons throughout.' }
      ],
      assets: [
        { id: 'diagrams', sheet: 1, caption: 'Bubble and zoning diagrams' },
        { id: 'palette', sheet: 1, caption: 'Colour palette and facade' }
      ]
    },
    plans: [
      { id: 'floor-plan', sheet: 3, caption: 'Floor plan', scale: '1:50' },
      { id: 'partial-plans', sheet: 8, caption: 'Partial plans', scale: '1:20' },
      { id: 'sections', sheet: 5, caption: 'Sections', scale: '1:50' },
      { id: 'site-plan', sheet: 2, caption: 'Site plan', scale: '1:200' }
    ],
    spaces: [
      { id: 'dining', sheet: 13, caption: 'Dining area' },
      { id: 'bar', sheet: 13, caption: 'Bar area' },
      { id: 'patio', sheet: 13, caption: 'Patio' },
      { id: 'dining-paintings', sheet: 13, caption: 'Dining area' },
      { id: 'restroom', sheet: 13, caption: 'Restroom' },
      { id: 'dining-bench', sheet: 13, caption: 'Dining area' }
    ],
    details: [
      { id: 'bench', sheet: 11, caption: 'Custom-made sectional bench seat', scale: '1:10 · 1:5 · 1:1' },
      { id: 'boards', sheet: 12, caption: 'Material board and furniture board' },
      { id: 'sections', sheet: 10, caption: 'Sections', scale: '1:20' }
    ]
  },

  {
    id: 'nature-retreat',
    number: '06',
    title: 'NATURE RETREAT',
    hero: { src: 'project-sheets/assets/nature-retreat-ground-floor.jpg', alt: 'NATURE RETREAT — ground floor plan', sheet: 8 },
    tagline: 'Reconnect with nature for mental purification',
    summary: 'A nature retreat concept aiming to reconnect people with nature for mental purification through serene and minimalist architecture: a rehabilitation campus of four-person living units on a steel structure.',
    overview: [
      'Inspired by the Beyazıt Külliyesi in Edirne, with its holistic understanding of healing and multi-functional campus logic. This set of sheets covers the site, the living units, the structure and the facade.'
    ],
    facts: [
      { label: 'Type', value: 'Rehabilitation centre' },
      { label: 'Location', value: 'Karaburun' },
      { label: 'Sheets', value: 'Site plan, sections, unit plans, structure' },
      { label: 'Studio', value: 'Interdisciplinary Studio II' }
    ],
    concept: {
      statement: 'A holistic understanding of healing.',
      points: [
        { title: 'Multi-functional campus logic', text: 'Inspired by the Beyazıt Külliyesi, Edirne.' },
        { title: 'Natural fabric', text: 'A coastal area with serene bays, rocks and native vegetation.' },
        { title: 'Relationship with the urban fabric', text: 'Create a buffer zone, preserve the coastal ecology, blend with the environment.' }
      ],
      assets: [
        { id: 'concept-board', sheet: 1, caption: 'Concept board: location and inspiration' },
        { id: 'sun-path', sheet: 2, caption: 'Sun path analysis' }
      ]
    },
    plans: [
      { id: 'floor-plans', sheet: 8, caption: 'Ground and first floor plans', scale: '1:50' },
      { id: 'ground-floor-site', sheet: 5, caption: 'Ground floor plan on site', scale: '1:50' },
      { id: 'sections', sheet: 4, caption: 'Sections C–C and F–F', scale: '1:50' }
    ],
    spaces: [
      { id: 'garden', sheet: 18, caption: 'Living unit and garden' },
      { id: 'living', sheet: 18, caption: 'Living area' },
      { id: 'courtyard', sheet: 18, caption: 'Courtyard' },
      { id: 'bedroom', sheet: 18, caption: 'Bedroom' },
      { id: 'balcony', sheet: 18, caption: 'Balcony' },
      { id: 'campus', sheet: 18, caption: 'Living units on the campus' }
    ],
    details: [
      { id: 'structure', sheet: 16, caption: 'Structure and 3D views', scale: '1:50' },
      { id: 'exploded', sheet: 17, caption: 'Exploded perspective, living unit modules and material table', scale: '1:50' },
      { id: 'facade-board', sheet: 2, caption: 'Facade material board: fibre cement panels and thermowood louvres' }
    ]
  },

  {
    id: 'nature-retreat-interiors',
    number: '07',
    title: 'NATURE RETREAT',
    hero: { src: 'project-sheets/assets/nature-retreat-plan.jpg', alt: 'NATURE RETREAT — furnished living unit plan', sheet: 4 },
    tagline: 'Reconnect with nature for mental purification',
    summary: 'The living unit of the Nature Retreat rehabilitation campus, developed as an interior: furnished plans, finishes, ceilings, services and custom joinery.',
    overview: [
      'Engineered wood floors, washable acrylic paint and gypsum board ceilings form a calm base. A bar counter with a wooden slat front is detailed from 1:20 down to 1:5.'
    ],
    facts: [
      { label: 'Type', value: 'Rehabilitation centre · Living unit interior' },
      { label: 'Location', value: 'Karaburun' },
      { label: 'Sheets', value: 'Furnished plans, flooring, ceilings, electrical, ventilation, plumbing, details' },
      { label: 'Studio', value: 'Interdisciplinary Studio II' }
    ],
    concept: {
      statement: 'Serene and minimalist.',
      points: [
        { title: 'Silence and minimalism', text: 'Flat and simple surfaces that reduce visual noise.' },
        { title: 'Healing through space', text: 'Sensory calmness and visual softness.' },
        { title: 'Reconnecting with nature', text: 'Natural materials that create a warm, tactile surface.' }
      ],
      assets: [
        { id: 'concept-board', sheet: 1, caption: 'Concept board' },
        { id: 'mood-board', sheet: 2, caption: 'Mood board' }
      ]
    },
    plans: [
      { id: 'ground-floor', sheet: 4, caption: 'Ground floor plan with furniture schedule', scale: '1:20' },
      { id: 'first-floor', sheet: 5, caption: 'First floor plan with furniture schedule', scale: '1:20' },
      { id: 'section', sheet: 12, caption: 'Section C–C', scale: '1:20' }
    ],
    spaces: [
      { id: 'guest-room', sheet: 20, caption: 'Guest room' },
      { id: 'kitchen', sheet: 20, caption: 'Bar counter' },
      { id: 'balcony', sheet: 20, caption: 'Balcony' },
      { id: 'living', sheet: 20, caption: 'Common living area' },
      { id: 'single-room', sheet: 20, caption: 'Guest room' }
    ],
    details: [
      { id: 'elevations', sheet: 14, caption: 'Ground floor wall detail elevations', scale: '1:20' },
      { id: 'bar-unit', sheet: 17, caption: 'Bar counter: wooden slat front and bar stool', scale: '1:20 · 1:10 · 1:5' },
      { id: 'plumbing', sheet: 19, caption: 'Bathroom plumbing plan and section', scale: '1:20' }
    ]
  }
];
