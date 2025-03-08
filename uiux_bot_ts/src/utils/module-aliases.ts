/**
 * Module aliases configuration for easier imports.
 * This file sets up module path aliases to match the paths specified in tsconfig.json
 */

import moduleAlias from 'module-alias';
import path from 'path';

// Path to the root of the project
const rootPath = path.resolve(__dirname, '../../');

// Register path aliases
moduleAlias.addAliases({
  '@app': path.join(rootPath, 'src/app'),
  '@database': path.join(rootPath, 'src/database'),
  '@config': path.join(rootPath, 'src/config'),
  '@utils': path.join(rootPath, 'src/utils'),
  '@tests': path.join(rootPath, 'src/tests')
}); 