# Béa Dynamic Wardrobe & Context System

## Design principle

Béa should respond to **weather, activity and travel context**, not perform a caricature of a destination.

Her core design is always:

- small white French bulldog
- lemon-pattern bandana
- same face/body proportions
- same recognizable Béa identity

Accessories are temporary layers.

## Priority

When deciding what Béa wears:

1. **Actual weather**
2. **Current travel/activity context**
3. **Season**
4. **Neutral environmental context**
5. Default Béa

Example: if the user is in Paris and it is raining, show **raincoat Béa**, not a "Paris costume."

## Good variants

### Rain
Yellow raincoat and/or small umbrella.

### Cold / snow
Puffer jacket and knit hat.

### Hot / sunny
Sun hat and/or sunglasses.

### Beach
Sun hat, beach towel, water bottle.

### Hiking / outdoors
Hiking harness or tiny backpack.

### Airport / flight
Neck pillow, small suitcase, luggage tag.

### Red-eye
Neck pillow + sleepy expression.

### Celebration
Simple party hat/confetti.

These are functional, universal and easy to understand.

## Destination flavor

Do **not** dress Béa as a nationality.

If a screen needs a sense of place, use neutral contextual elements such as:

- map route
- coastline
- mountains
- transit
- generic city architecture
- relevant landmark silhouette
- weather
- trip activity

Keep those as environmental props/background cues rather than changing Béa's cultural identity.

## Cultural safety rules

Automatic wardrobe logic must never use:

- traditional/ceremonial/religious/indigenous dress as costume
- religious head coverings
- ethnicity-coded skin/fur/eye/body changes
- fake accents or dialect mimicry
- national caricatures
- flag costumes
- sacred symbols as decoration
- food/alcohol/crime/religion as shorthand for a people or place
- novelty versions of culturally significant clothing
- stereotypical tourist outfits as city/country shorthand

Examples of patterns to avoid include assigning a beret to France, sombrero to Mexico, lederhosen to Germany, kimono/geisha styling to Japan, etc. simply because of destination metadata.

The automatic system should **never infer culture from location and dress Béa accordingly**.

If the product team later wants a culturally specific asset for a particular event, that should be handled as an individually reviewed design/content task with appropriate research and context. It should not be generated automatically.

## Personality integration

Wardrobe can change Béa's comment while preserving the user's personality mix.

Example: puffer jacket

Helpful:
> “Béa is checking the route. Cold-weather logistics included.”

Funny:
> “Béa has become approximately 40% jacket.”

Sassy:
> “Apparently this trip requires dressing like a marshmallow.”

Dramatic:
> “These tiny legs have been asked to endure winter.”

Chill:
> “Cold out. Béa brought layers.”

## Technical architecture

Prefer:

`base Béa animation + accessory overlay + optional prop`

rather than:

`separate fully rendered Béa asset for every action/outfit combination`

This keeps the asset system maintainable.

If the accessory cannot align cleanly with a particular pose, fall back to default Béa. A clean default is better than a broken costume.

## Appropriate surfaces

Wardrobe variants work well in:

- loading screens
- Companion
- empty states
- first-use/onboarding
- success moments
- selected banners

Avoid persistent costumed Béa on dense functional screens such as live maps, timelines, lists and forms.
