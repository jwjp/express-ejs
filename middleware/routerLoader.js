// middleware/routerLoader.js

import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { logger } from '#utils/logger';

const registerRoute = async (app, fullPath, cleanRoute) => {
  try {
    const routeModule = await import(pathToFileURL(fullPath).href);
    const routeHandler = routeModule.default || routeModule.router;

    if (routeHandler) {
      app.use(cleanRoute, routeHandler);
      logger.info(`Route registered: ${cleanRoute} (${fullPath})`);
    } else {
      logger.warn(`No router found in ${fullPath}. Use a default export or a named 'router' export.`);
    }
  } catch (err) {
    logger.error(`Error loading route ${fullPath}: ${err.message}`);
    throw err;
  }
};

const sortRoutes = (entries) => {
  return entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? 1 : -1;
    }
    if (a.name === 'index.js') return -1;
    if (b.name === 'index.js') return 1;
    return a.name.localeCompare(b.name);
  });
};

const routerLoader = (controllerPath) => async (app) => {
  const registerRoutes = async (dir, baseRoute = '') => {
    const entries = sortRoutes(fs.readdirSync(dir, { withFileTypes: true }));

    for (const dirent of entries) {
      const fullPath = path.join(dir, dirent.name);

      if (dirent.isDirectory()) {
        await registerRoutes(fullPath, `${baseRoute}/${dirent.name}`);
        continue;
      }

      if (!dirent.name.endsWith('.js')) {
        continue;
      }

      const routeName = path.basename(dirent.name, '.js');
      const route = routeName === 'index' ? baseRoute : `${baseRoute}/${routeName}`;
      const cleanRoute = route.replace(/\/+/g, '/').replace(/^\/$/, '') || '/';
      await registerRoute(app, fullPath, cleanRoute);
    }
  };

  await registerRoutes(controllerPath);
  return app;
};

export default routerLoader;
