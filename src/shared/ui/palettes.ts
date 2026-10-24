import type { Accent } from '@/core/model/settings';

/** Accent colors for one mode. Heat levels 1–4 shade the practice-history grid. */
interface ModePalette {
  accent: string;
  shade: string;
  soft: string;
  text: string;
  heat: [string, string, string, string];
}

export interface AccentPalette {
  name: string;
  description: string;
  light: ModePalette;
  dark: ModePalette;
}

/**
 * Accent themes. Each has light and dark variants tuned so accent text stays readable
 * on the surface it sits on. The four outcome colors never change.
 */
export const PALETTES: Record<Accent, AccentPalette> = {
  grape: {
    name: 'Grape',
    description: 'Soft purple. Never clashes with the outcome colors.',
    light: {
      accent: '#ce82ff',
      shade: '#a35fd6',
      soft: '#f5e8ff',
      text: '#8441b8',
      heat: ['#ecd9fb', '#d7b2f6', '#b47ae6', '#8441b8'],
    },
    dark: {
      accent: '#ce82ff',
      shade: '#9a5cc4',
      soft: '#2c2440',
      text: '#dcaaff',
      heat: ['#3a2f55', '#5c4288', '#8d5fc2', '#ce82ff'],
    },
  },
  ocean: {
    name: 'Ocean',
    description: 'Calm teal.',
    light: {
      accent: '#2ec4b6',
      shade: '#1f9e92',
      soft: '#dcf6f3',
      text: '#137a70',
      heat: ['#d3f3ef', '#9de4dc', '#4fcabd', '#1f9e92'],
    },
    dark: {
      accent: '#2ec4b6',
      shade: '#1f8f84',
      soft: '#173634',
      text: '#7fe3d8',
      heat: ['#1d4642', '#24685f', '#2c9c8f', '#5fe0d2'],
    },
  },
  fox: {
    name: 'Fox',
    description: 'Warm orange.',
    light: {
      accent: '#ff9600',
      shade: '#d97e00',
      soft: '#fff0db',
      text: '#a85d00',
      heat: ['#ffe7c4', '#ffcb80', '#ffa733', '#d97e00'],
    },
    dark: {
      accent: '#ff9600',
      shade: '#c27000',
      soft: '#3a2c17',
      text: '#ffc06b',
      heat: ['#4a3416', '#7a5418', '#b8780f', '#ffa733'],
    },
  },
  flamingo: {
    name: 'Flamingo',
    description: 'Bright pink.',
    light: {
      accent: '#ff6fae',
      shade: '#d94f8d',
      soft: '#ffe6f1',
      text: '#b8326f',
      heat: ['#ffdbe9', '#ffb0d2', '#ff7fb6', '#d94f8d'],
    },
    dark: {
      accent: '#ff6fae',
      shade: '#c74a82',
      soft: '#3d2030',
      text: '#ffa6cd',
      heat: ['#4a2235', '#7a3157', '#b5487f', '#ff7fb6'],
    },
  },
  indigo: {
    name: 'Indigo',
    description: 'Cool blue-violet.',
    light: {
      accent: '#7c8cff',
      shade: '#5a68d9',
      soft: '#e9ebff',
      text: '#4351c4',
      heat: ['#e1e4ff', '#bcc3ff', '#8f9bff', '#5a68d9'],
    },
    dark: {
      accent: '#7c8cff',
      shade: '#5562c9',
      soft: '#23284a',
      text: '#b3bbff',
      heat: ['#262c55', '#363f85', '#4d5ac0', '#8f9bff'],
    },
  },
  owl: {
    name: 'Owl',
    description: 'The original green. Same color as the Solved button.',
    light: {
      accent: '#58cc02',
      shade: '#46a302',
      soft: '#e8f8da',
      text: '#3d7f05',
      heat: ['#c9f0a6', '#8fdb4c', '#58cc02', '#3a8a00'],
    },
    dark: {
      accent: '#58cc02',
      shade: '#3f9a00',
      soft: '#1e3519',
      text: '#8ee04a',
      heat: ['#1d4d2a', '#2c7a1a', '#46a302', '#7ee031'],
    },
  },
  graphite: {
    name: 'Graphite',
    description: 'Quiet gray. Lets the outcome colors do the talking.',
    light: {
      accent: '#9aa8b4',
      shade: '#6f7d89',
      soft: '#eef1f4',
      text: '#47535d',
      heat: ['#dfe4e9', '#c2cbd3', '#93a1ad', '#5f6d78'],
    },
    dark: {
      accent: '#9aa8b4',
      shade: '#6a7884',
      soft: '#26333a',
      text: '#c9d3db',
      heat: ['#2a3a42', '#40525b', '#62767f', '#9aa8b4'],
    },
  },
};

/** Sets the accent CSS variables on an element (<html>, or the widget's shadow host). */
export function applyAccent(el: HTMLElement, accent: Accent, mode: 'light' | 'dark'): void {
  const p = PALETTES[accent][mode];
  el.style.setProperty('--ip-accent', p.accent);
  el.style.setProperty('--ip-accent-shade', p.shade);
  el.style.setProperty('--ip-accent-soft', p.soft);
  el.style.setProperty('--ip-accent-text', p.text);
  p.heat.forEach((c, i) => el.style.setProperty(`--ip-heat-${i + 1}`, c));
}
