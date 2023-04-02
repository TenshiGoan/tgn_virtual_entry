import { defineNuxtModule, createResolver } from '@nuxt/kit';
import { createUnplugin } from 'unplugin';
import Proxy from 'http-proxy';

function getSourceCode$1(headers, body) {
  headers.push(
    `import "#internal/nitro/virtual/polyfill";`,
    `import { Server } from "node:http";`,
    `import { tmpdir } from "node:os";`,
    `import { join } from "node:path";`,
    `import { mkdirSync } from "node:fs";`,
    `import { threadId, parentPort, BroadcastChannel } from "node:worker_threads";`,
    `import { isWindows, provider } from "std-env";`,
    `import { toNodeListener } from "h3";`,
    ``,
    `//@ts-ignore`,
    `import { nitroApp } from "#internal/nitro/app";`
  );
  body.push(
    `const server = new Server(toNodeListener(nitroApp.h3App));`,
    ``,
    `const bc = new BroadcastChannel('socket.io');`,
    `server.listen(0, () => {`,
    `  const _address = server.address();`,
    `  const event = "listen";`,
    `  const address = typeof _address === "string"`,
    `                    ? { socketPath: _address }`,
    `                    : { host: "localhost", port: _address?.port };`,
    `  parentPort?.postMessage({ event, address });`,
    `  bc?.postMessage({ event, address });`,
    `});`,
    ``,
    `if (process.env.DEBUG) {`,
    `  process.on("unhandledRejection", (err) =>`,
    `    console.error("[nitro] [dev] [unhandledRejection]", err)`,
    `  );`,
    `  process.on("uncaughtException", (err) =>`,
    `    console.error("[nitro] [dev] [uncaughtException]", err)`,
    `  );`,
    `} else {`,
    `  process.on("unhandledRejection", (err) =>`,
    `    console.error("[nitro] [dev] [unhandledRejection] " + err)`,
    `  );`,
    `  process.on("uncaughtException", (err) =>`,
    `    console.error("[nitro] [dev] [uncaughtException] " + err)`,
    `  );`,
    `}`,
    ``
  );
}

function getSourceCode(headers, body) {
  headers.push(
    `import "#internal/nitro/virtual/polyfill";`,
    `import { Server as HttpServer } from "node:http";`,
    `import type { AddressInfo } from "node:net";`,
    `import { Server as HttpsServer } from "node:https";`,
    `import destr from "destr";`,
    `import { toNodeListener } from "h3";`,
    `import { useRuntimeConfig } from "#internal/nitro";`,
    ``,
    `//@ts-ignore`,
    `import { nitroApp } from "#internal/nitro/app";`
  );
  body.push(
    `const cert = process.env.NITRO_SSL_CERT;`,
    `const key = process.env.NITRO_SSL_KEY;`,
    ``,
    `const server =`,
    `  cert && key`,
    `    ? new HttpsServer({ key, cert }, toNodeListener(nitroApp.h3App))`,
    `    : new HttpServer(toNodeListener(nitroApp.h3App));`,
    `    `,
    `const port = (destr(process.env.NITRO_PORT || process.env.PORT) ||`,
    `  3000) as number;`,
    `const host = process.env.NITRO_HOST || process.env.HOST;`,
    ``,
    `// @ts-ignore`,
    `const s = server.listen(port, host, (err) => {`,
    `  if (err) {`,
    `    console.error(err);`,
    `    // eslint-disable-next-line unicorn/no-process-exit`,
    `    process.exit(1);`,
    `  }`,
    `  const protocol = cert && key ? "https" : "http";`,
    `  const i = s.address() as AddressInfo;`,
    `  const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\\/$/, "");`,
    `  const url = \`\${protocol}://\${`,
    `    i.family === "IPv6" ? \`[\${i.address}]\` : i.address`,
    `  }:\${i.port}\${baseURL}\`;`,
    `  console.log(\`Listening \${url}\`);`,
    `});`,
    ``,
    `if (process.env.DEBUG) {`,
    `  process.on("unhandledRejection", (err) =>`,
    `    console.error("[nitro] [dev] [unhandledRejection]", err)`,
    `  );`,
    `  process.on("uncaughtException", (err) =>`,
    `    console.error("[nitro] [dev] [uncaughtException]", err)`,
    `  );`,
    `} else {`,
    `  process.on("unhandledRejection", (err) =>`,
    `    console.error("[nitro] [dev] [unhandledRejection] " + err)`,
    `  );`,
    `  process.on("uncaughtException", (err) =>`,
    `    console.error("[nitro] [dev] [uncaughtException] " + err)`,
    `  );`,
    `}`,
    ``,
    `export default {};`
  );
}

const ENTRY_FILENAME = "tgn/virtual-entry/entry.ts";
const module = defineNuxtModule({
  meta: {
    name: "@tgn/virtual-entry",
    configKey: "virtual_entry"
  },
  defaults: {},
  setup(_, nuxt) {
    const { dev } = nuxt.options;
    const resolve = createResolver(import.meta.url).resolve;
    const filepath = resolve(nuxt.options.buildDir, ENTRY_FILENAME);
    if (nuxt.options.nitro.preset && nuxt.options.nitro.preset !== "node-server") {
      throw new Error(`@tgn/virtual-entry work only with node-server preset`);
    }
    nuxt.hook("nitro:build:before", async (nitro) => {
      nitro.options.entry = filepath;
    });
    nuxt.hook("nitro:config", (config) => {
      var _a;
      config.rollupConfig ?? (config.rollupConfig = {});
      (_a = config.rollupConfig).plugins ?? (_a.plugins = []);
      if (!Array.isArray(config.rollupConfig.plugins)) {
        config.rollupConfig.plugins = [config.rollupConfig.plugins];
      }
      config.rollupConfig.plugins.unshift(
        VirtualEntryPlugin.rollup({
          filepath,
          async getSourceCode(lines) {
            const headers = [];
            const body = [];
            if (dev) {
              getSourceCode$1(headers, body);
            } else {
              getSourceCode(headers, body);
            }
            await nuxt.callHook("tgn:virtual-entry:source", { headers, body });
            lines.push(...headers, ...body);
          }
        })
      );
    });
    if (dev) {
      const channel = new BroadcastChannel("socket.io");
      const proxy = Proxy.createProxy({});
      let target = {};
      const proxy_ready = new Promise((resolve2) => {
        channel.onmessage = ({ data }) => {
          if (data.event === "listen") {
            target = {
              host: "localhost",
              port: data.address.port
            };
            resolve2();
          }
        };
      });
      nuxt.hook("listen", (server) => {
        server.on("upgrade", async (req, socket, head) => {
          await proxy_ready;
          proxy.ws(req, socket, head, { target });
        });
      });
      nuxt.hook(
        "close",
        () => new Promise((resolve2) => {
          proxy.close(resolve2);
        })
      );
    }
  }
});
const VirtualEntryPlugin = createUnplugin((options) => {
  return {
    name: "VirtualEntryPlugin",
    resolveId(id) {
      if (id !== options.filepath) {
        return null;
      }
      return id;
    },
    async load(id) {
      if (id !== options.filepath) {
        return null;
      }
      const lines = [];
      await options.getSourceCode(lines);
      return lines.join("\n");
    }
  };
});

export { module as default };
