# Béa Personality Builder — Final UX Spec

## Location

Add the control inside:

**Profile → Béa → Personality**

If Profile already contains a Settings subsection, use:

**Profile → Settings → Béa → Personality**

## Default

New users start with **Balanced**:

- Helpful 35
- Funny 35
- Sassy 20
- Encouraging 10
- Curious 0
- Adventurous 0
- Dramatic 0
- Chill 0

## Main screen

Show a simple preset row first:

**Balanced · Helpful · Funny · Sassy · Minimal · Custom**

Below it, show:

**Customize Béa**

Expanding Customize Béa reveals eight 0–100 sliders:

1. Helpful
2. Funny
3. Sassy
4. Encouraging
5. Curious
6. Adventurous
7. Dramatic
8. Chill

Each slider displays its current intensity as a percentage.

### Important behavior

The sliders are **independent intensities**. Users should not have to make them add up to 100.

Example:

- Helpful 80%
- Funny 70%
- Sassy 40%
- Curious 60%

At runtime, normalize the non-zero values into selection weights.

This is easier to understand than asking users to rebalance every other slider whenever they change one.

## Custom state

The moment a user moves any slider manually:

- preset becomes **Custom**
- values persist in the user's normal app settings storage
- show a small **Reset to Balanced** control
- optional: allow **Save as my Béa** wording, but do not require an extra save step if settings normally auto-save

## Live preview

Below the sliders, include a small preview card:

**Meet your Béa**

Then rotate or regenerate one example when the user taps:

**Try another**

The preview should combine currently selected traits.

Examples:

### High Helpful + Chill
> Béa is checking the options. No rush.

### High Funny + Dramatic
> Béa was focused. Then there was a ball. Everything has changed.

### High Sassy + Curious
> Béa checked the obvious options. They were obvious for a reason.

## Trait definitions

### Helpful
Clear, practical, useful.

### Funny
Dog puns, self-deprecation, tiny-leg humor.

### Sassy
Dry sarcasm directed at situations/options/Béa herself — never the user.

### Encouraging
Warm and supportive.

### Curious
Inquisitive; fascinated by hidden details and unusual discoveries.

### Adventurous
Likes detours, hidden gems and less obvious options.

### Dramatic
Theatrical overreaction for comic effect.

### Chill
Understated, relaxed, low-energy humor.

## Béa quirks are NOT sliders

Keep these as occasional recurring motifs across compatible personalities:

- tiny legs
- tennis balls
- bones
- sniffing
- digging
- maps
- snacks
- naps
- questionable stamina
- French bulldog stubbornness

The user controls Béa's **tone**, not whether she is a dog.

## Where personality applies

Personality selection can influence:

- loading comments
- empty-state comments
- Companion conversational flourishes
- recommendation intros
- small celebratory/status comments
- non-critical onboarding copy

It must NOT modify:

- prices
- booking details
- addresses
- directions
- opening hours
- factual recommendation data
- confirmations
- safety information
- payment/account/security messaging
- errors that need clear remediation

## Empty states

Use the user's selected personality for static Béa empty states such as:

- no trips
- no saved recommendations
- no saved places
- no results

Do not animate Béa as if she is working when the state is simply empty.

## Accessibility

Every trait needs:
- visible label
- short explanatory text
- numeric value
- controls usable without drag gestures alone

Support increment/decrement buttons or platform-standard accessible sliders.

## Avoid

Do not turn this into an overly technical audio-mixer interface. It should feel playful and simple.

Do not expose normalized mathematical weights to normal users. Show only their chosen 0–100 intensities.
