var _a, _b;
import { defineConfig } from 'vitest/config';
var repositoryName = (_b = (_a = process.env.GITHUB_REPOSITORY) === null || _a === void 0 ? void 0 : _a.split('/')[1]) !== null && _b !== void 0 ? _b : 'soilFEM';
export default defineConfig({
    base: process.env.GITHUB_ACTIONS ? "/".concat(repositoryName, "/") : '/',
    test: {
        environment: 'node',
    },
});
