import { defineNuxtModule, createResolver } from "@nuxt/kit";
import { createUnplugin } from "unplugin";
import type { IncomingMessage } from "node:http";
import Proxy from "http-proxy";

import createDevSource from "./runtime/nitro-dev";
import createServerSource from "./runtime/node-server";

type HookReturnValue = void | Promise<void>;

export interface ModuleHooks {
  "tgn:virtual-entry:source"(source: {
    headers: string[];
    body: string[];
  }): HookReturnValue;
}

declare module "@nuxt/schema" {
  interface NuxtHooks extends ModuleHooks {}
}

export interface ModuleOptions {}

const ENTRY_FILENAME = "tgn/virtual-entry/entry.ts";

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: "@tgn/virtual-entry",
    configKey: "virtual_entry",
  },
  defaults: {},
  setup(_, nuxt) {
    const { dev } = nuxt.options;
    const resolve = createResolver(import.meta.url).resolve;
    const filepath = resolve(nuxt.options.buildDir, ENTRY_FILENAME);

    if (
      nuxt.options.nitro.preset &&
      nuxt.options.nitro.preset !== "node-server"
    ) {
      throw new Error(`@tgn/virtual-entry work only with node-server preset`);
    }

    nuxt.hook("nitro:build:before", async (nitro) => {
      nitro.options.entry = filepath;
    });

    nuxt.hook("nitro:config", (config) => {
      config.rollupConfig ??= {};
      config.rollupConfig.plugins ??= [];
      if (!Array.isArray(config.rollupConfig.plugins)) {
        config.rollupConfig.plugins = [config.rollupConfig.plugins];
      }
      config.rollupConfig.plugins.unshift(
        VirtualEntryPlugin.rollup({
          filepath,
          async getSourceCode(lines) {
            const headers: string[] = [];
            const body: string[] = [];

            if (dev) {
              createDevSource(headers, body);
            } else {
              createServerSource(headers, body);
            }

            await nuxt.callHook("tgn:virtual-entry:source", { headers, body });

            lines.push(...headers, ...body);
          },
        })
      );
    });

    if (dev) {
      const channel = new BroadcastChannel("socket.io");
      const proxy = Proxy.createProxy({});
      let target: Proxy.ProxyTarget = {};

      const proxy_ready = new Promise<void>((resolve) => {
        channel.onmessage = ({ data }: any) => {
          if (data.event === "listen") {
            target = {
              host: "localhost",
              port: data.address.port,
            };
            resolve();
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
        () =>
          new Promise((resolve) => {
            proxy.close(resolve);
          })
      );
    }
  },
});

type Options = {
  filepath: string;
  getSourceCode: (lines: string[]) => void | Promise<void>;
};

const VirtualEntryPlugin = createUnplugin<Options>((options) => {
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
      const lines: string[] = [];
      await options.getSourceCode(lines);
      return lines.join("\n");
    },
  };
});
