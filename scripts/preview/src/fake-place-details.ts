/** Place details for the preview: the museum keeps hours that start after its 09:30 stop. */
export type PlaceDetails = { name?: string; openingHours?: string; website?: string; phone?: string; wheelchair?: string };
export const placeDetails = async ({ data }: { data: { name: string } }): Promise<PlaceDetails | null> =>
  /Museum/.test(data.name)
    ? { name: data.name, openingHours: "Mo-Su 10:00-18:00", website: "https://hpmmuseum.jp/", phone: "+81 82-241-4004", wheelchair: "yes" }
    : null;
// A 1×1 JPEG stands in for a day's map.
export const dayMapImage = async () =>
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
