/* global React */
// Mock data — folders + files seeded from the actual repo
// Each file: { name, kind, body, dirty }
const FOLDER_KINDS = {
  npcs: 'npc',
  locations: 'location',
  factions: 'faction',
  plots: 'plot',
  rules: 'rule',
  sessions: 'session',
  'player-facing': 'player-facing',
  misc: 'misc',
};

const KIND_COLORS = {
  npc: 'var(--kind-npc)',
  location: 'var(--kind-location)',
  faction: 'var(--kind-faction)',
  plot: 'var(--kind-plot)',
  rule: 'var(--kind-rule)',
  session: 'var(--kind-session)',
  misc: 'var(--kind-misc)',
  'player-facing': 'var(--kind-player-facing)',
};

const FOLDER_LABELS = {
  npcs: 'npcs',
  locations: 'locations',
  factions: 'factions',
  plots: 'plots',
  rules: 'rules',
  sessions: 'sessions',
  'player-facing': 'player-facing',
  misc: 'misc',
};

const SEED = {
  npcs: [
    { name: 'aella-stormcaller.md', body:
`# Aella Stormcaller

Daughter of [Elara Stormweaver](elara-stormweaver.md) and head alchemist of [The House of Storms](../factions/house-of-storms.md). Invented a new drug by channelling static energy through a device placed on farmland, inadvertently causing sparking cows and combusting addicts around [Stormhaven](../locations/stormhaven.md).

Operates a drug-lab ship in partnership with [Zephyr Swiftwind](zephyr-swiftwind.md) of the [Free Sails](../factions/free-sails.md). The ship was seized by the party on Desnus 4. Aella herself escaped unnoticed during the ambush.

## Status

- **Last seen:** Desnus 4, fleeing the lab-ship
- **Disposition:** Hostile
- **Bounty:** 800 gp, posted by [The Reps](../factions/the-reps.md)
` },
    { name: 'elara-stormweaver.md', body:
`# Elara Stormweaver

Matriarch of [The House of Storms](../factions/house-of-storms.md). Mother to [Aella Stormcaller](aella-stormcaller.md). Holds court in the upper terraces of [Stormhaven](../locations/stormhaven.md).

Believed to be in her late sixties; rumored to have struck a bargain with a storm spirit in her youth.
` },
    { name: 'zephyr-swiftwind.md', body:
`# Zephyr Swiftwind

Captain in the [Free Sails](../factions/free-sails.md). Ran the drug-lab ship with [Aella Stormcaller](aella-stormcaller.md) until its capture on Desnus 4.

> "I sail where the wind takes me — and right now, the wind smells like guilders."
` },
    { name: 'nova-fuzzymaw.md', body:
`# Nova Fuzzymaw

Awakened bear, leader of [The Carvers](../factions/the-carvers.md). Speaks slowly. Likes blueberry mead.
` },
    { name: 'borka-rockheart.md', body:
`# Borka Rockheart

Hobgoblin cleric of Shelyn. Construction lead for [The Carvers](../factions/the-carvers.md). Has a soft spot for the orphans of [Stormhaven](../locations/stormhaven.md).
` },
  ],
  locations: [
    { name: 'stormhaven.md', body:
`# Stormhaven

The main city on the island of [Emberheart](emberheart-island.md). A port town built on the ruins of an ancient city, trapped by a magical barrier that prevents escape. Fractured between [competing factions](../factions/the-reps.md) spanning commerce, religion, trade, and industry.

## Districts and Notable Locations

- [The Spire](stormhaven/the-spire.md) — temple of Pharasma
- [Abadar's Bazaar](stormhaven/abadars-bazaar.md) — main commercial district
- [The Lumina Spire](stormhaven/lumina-spire.md) — arcane mage tower (north-east docks)
- [The Great Tree](stormhaven/the-great-tree.md) — primal druid tower
- [The Whispering Claw](stormhaven/the-whispering-claw.md) — occult witch tower
- [The Shifting Sands](stormhaven/the-shifting-sands.md) — inn, north-east docks
` },
    { name: 'emberheart-island.md', body:
`# Emberheart Island

Volcanic island. Home of [Stormhaven](stormhaven.md) and [The Volcano](the-volcano.md). The barrier surrounds the entire coastline.
` },
    { name: 'the-volcano.md', body:
`# The Volcano

Active. Smoking. The locals call it *the Maw*. A pilgrimage site for clerics of Asmodeus.

> Erupted on Pharast 17, ruining the spring harvest.
` },
    { name: 'newhaven.md', body:
`# Newhaven

Smaller settlement on the north shore of [Emberheart](emberheart-island.md). Mostly fishermen and goat herders.
` },
  ],
  factions: [
    { name: 'the-carvers.md', body:
`# The Carvers

The construction and infrastructure faction. Though not adventuring-oriented, the town literally falls apart without them.

**Slang:** Stoners, callused, bloodless.

**Goods:** Wood and Stone, city infrastructure and repair.

---

## Leadership

- [Nova Fuzzymaw](../npcs/nova-fuzzymaw.md) — Leader (Awakened Bear)
- [Borka Rockheart](../npcs/borka-rockheart.md) — Construction
` },
    { name: 'house-of-storms.md', body:
`# The House of Storms

Mage cabal led by [Elara Stormweaver](../npcs/elara-stormweaver.md). Specializes in storm and weather magic. Headquartered in [Stormhaven](../locations/stormhaven.md)'s upper terraces.

Recently embroiled in scandal after [Aella Stormcaller](../npcs/aella-stormcaller.md)'s drug operation became public knowledge.
` },
    { name: 'free-sails.md', body:
`# The Free Sails

Pirate confederacy. No central authority — captains sign the Articles and that's it.

Notable captains:
- [Zephyr Swiftwind](../npcs/zephyr-swiftwind.md)
` },
    { name: 'the-reps.md', body:
`# The Reps

The closest thing [Stormhaven](../locations/stormhaven.md) has to a city council. Each major faction sends a representative.

Recently issued bounties on [Aella Stormcaller](../npcs/aella-stormcaller.md).
` },
  ],
  plots: [
    { name: 'sparking-cows.md', body:
`# The Sparking Cows

[Aella Stormcaller](../npcs/aella-stormcaller.md)'s static-energy drug operation. Side effects:
- Cows on affected farmland exhibit visible static discharge.
- Addicts have spontaneously combusted.

The party captured the lab-ship on Desnus 4 but Aella escaped.
` },
  ],
  rules: [
    { name: 'house-rules.md', body:
`# House Rules

## Initiative

- Roll once per encounter, used for all rounds.

## Critical Hits

- Natural 20 confirms automatically.

## Inspiration

- Awarded for great roleplay or clever solutions.
` },
  ],
  sessions: [],
  'player-facing': [
    { name: 'recap-desnus-4.md', body:
`# Recap — Desnus 4

The party stormed the lab-ship at dawn. After a brief but vicious fight on deck, the smugglers surrendered. [Aella Stormcaller](../npcs/aella-stormcaller.md) was nowhere to be found in the manifest.

> A scrap of charred parchment in the captain's quarters bears the sigil of [The House of Storms](../factions/house-of-storms.md).
` },
  ],
  misc: [
    { name: 'random-tables.md', body:
`# Random tables

## Stormhaven street encounters (d6)

1. A drunk **Carver** challenging passers-by to arm-wrestle
2. A street preacher of [Asmodeus](../factions/asmodeus.md)
3. Two children racing crabs
4. An apprentice from [The Lumina Spire](../locations/stormhaven/lumina-spire.md)
5. A goat. Just a goat.
6. A robed figure who *seems* to know your name.
` },
  ],
};

// Build link index from seed (for @-mention picker)
function buildLinkIndex(state) {
  const out = [];
  for (const [folder, files] of Object.entries(state)) {
    const kind = FOLDER_KINDS[folder] || 'misc';
    for (const f of files) {
      const m = /^#\s+(.+)$/m.exec(f.body);
      const title = m ? m[1].trim() : f.name.replace(/\.md$/, '');
      out.push({ title, path: `${folder}/${f.name}`, kind, folder, filename: f.name });
    }
  }
  return out;
}

window.NotesData = { SEED, FOLDER_KINDS, KIND_COLORS, FOLDER_LABELS, buildLinkIndex };
