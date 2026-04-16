import Resolver from "@forge/resolver";

const resolver = new Resolver();

resolver.define("getProgress", async () => ({
  label: "Engineering dashboard rollout",
  percent: 72,
  value: 0.72
}));

export const handler = resolver.getDefinitions();
