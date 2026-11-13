import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Emotion's `css` prop isn't a DOM property React knows about
      'react/no-unknown-property': 'off',
      'react/jsx-no-comment-textnodes': 'off',
      'react/no-unescaped-entities': 'off',
      // Some fonts are only needed on some pages (the post and profile pages
      // load a writer's chosen font), so they're linked from the page itself.
      '@next/next/no-page-custom-font': 'off',
      // The only <img>s are profile pictures and images inside posts. They come
      // from wherever the writer hosts them, so next/image can't be configured
      // for their hosts.
      '@next/next/no-img-element': 'off',
      // eslint-plugin-react-hooks now ships the React Compiler's rules. The
      // code they flag was written before them and runs fine without the
      // compiler (it isn't enabled). Warnings keep the list visible without
      // failing the run; fix them as the files are touched.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'producthunt*/**']),
])

export default eslintConfig
