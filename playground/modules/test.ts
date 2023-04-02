import { defineNuxtModule } from "@nuxt/kit";

export default defineNuxtModule({
  setup(resolvedOptions, nuxt) {
    nuxt.hook("tgn:virtual-entry:source", function (source) {
      source.body.push("console.log(server);");
    });
  },
});
