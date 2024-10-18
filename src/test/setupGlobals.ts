import { chrome } from "./bunTestChrome";

global.chrome = global.chrome || {};
Object.assign(global.chrome, chrome);
