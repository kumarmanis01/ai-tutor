export function loadEnv() {
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config();
  }
}
