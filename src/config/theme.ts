import { createTheme } from '@mantine/core';

/** Custom violet palette matching Leona Projetos brand */
const violet = [
  '#f3e8ff',
  '#e0cffc',
  '#c9a9f7',
  '#b07df3',
  '#9b59ef',
  '#8b3fed',
  '#7c3aed',
  '#6a2dc7',
  '#5a25a2',
  '#491d84',
] as const;

export const theme = createTheme({
  primaryColor: 'violet',
  colors: {
    violet,
    dark: [
      '#c9c9c9', // 0 - lightest text
      '#b8b8b8', // 1
      '#828282', // 2
      '#696969', // 3
      '#4a4a4a', // 4
      '#3a3a3a', // 5
      '#2e2e2e', // 6 - borders
      '#242424', // 7 - surface
      '#1e1e1e', // 8 - elevated surface
      '#191919', // 9 - background (Notion dark)
    ],
  },
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: '700',
  },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: {
      defaultProps: {
        variant: 'filled',
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: {
          backgroundOpacity: 0.7,
          blur: 4,
        },
      },
    },
    Drawer: {
      defaultProps: {
        overlayProps: {
          backgroundOpacity: 0.5,
          blur: 3,
        },
      },
    },
    Notification: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});
