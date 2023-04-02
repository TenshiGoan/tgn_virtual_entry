
import { ModuleOptions, ModuleHooks } from './module'

declare module '@nuxt/schema' {
  interface NuxtConfig { ['virtual_entry']?: Partial<ModuleOptions> }
  interface NuxtOptions { ['virtual_entry']?: ModuleOptions }
  interface NuxtHooks extends ModuleHooks {}
}


export { ModuleHooks, ModuleOptions, default } from './module'
