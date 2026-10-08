export * from "../../../src/lib/city-locate";
import { pinCityStops as pin } from "../../../src/lib/city-locate";
export async function pinCityStops(...args: Parameters<typeof pin>) {
  const w = window as unknown as {__cityPins?: unknown[]};
  (w.__cityPins ??= []).push(args[0]);
  return pin(...args);
}
