import { setWorldConstructor, World } from "@deepracticex/bdd";

export class RouterXWorld extends World {
  // Server / HTTP test state
  app?: any;
  httpResponse?: Response;
  httpResponseBody?: any;
}

setWorldConstructor(RouterXWorld);
