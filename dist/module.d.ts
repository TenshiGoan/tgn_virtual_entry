import * as _nuxt_schema from '@nuxt/schema';

type HookReturnValue = void | Promise<void>;
interface ModuleHooks {
    "tgn:virtual-entry:source"(source: {
        headers: string[];
        body: string[];
    }): HookReturnValue;
}
declare module "@nuxt/schema" {
    interface NuxtHooks extends ModuleHooks {
    }
}
interface ModuleOptions {
}
declare const _default: _nuxt_schema.NuxtModule<ModuleOptions>;

export { ModuleHooks, ModuleOptions, _default as default };
